import prisma from "../../../config/db.config.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";
import { isRosterWindowOpen } from "./league.rules.ts";

/**
 * Lifecycle rule (user request):
 * - No deadline            → INACTIVE (never auto-advances).
 * - Deadline today/future  → REGISTRATION (window open).
 * - Deadline past          → ACTIVE (window closed), if ACTIVE requirements
 *   hold (≥2 teams, each with ≥1 player). Otherwise stays REGISTRATION.
 * Manual status changes by an admin always remain possible (override),
 * but REGISTRATION requires an empty or today-or-future deadline.
 */
export async function meetsActiveRequirements(leagueId: number): Promise<boolean> {
  const teams = await prisma.leagueTeam.findMany({
    where: {
      leagueId,
      status: "ACTIVE",
      team: { status: { not: "DELETED" } },
    },
    select: {
      id: true,
      _count: {
        select: {
          members: {
            where: {
              status: "ACTIVE",
              teamSeasonMember: { role: "PLAYER" },
            },
          },
        },
      },
    },
  });
  if (teams.length < 2) return false;
  if (teams.some((t) => t._count.members === 0)) return false;
  return true;
}

/** Promote a single REGISTRATION league to ACTIVE if its deadline passed. */
export async function maybeAdvanceSingleLeague(
  league: { id: number; status: string; rosterDeadline: Date | null },
  now = new Date(),
): Promise<"ACTIVE" | "REGISTRATION" | string> {
  if (league.status !== "REGISTRATION") return league.status;
  // No deadline → not a registration window; fall back to INACTIVE.
  if (!league.rosterDeadline) {
    await prisma.league.update({
      where: { id: league.id },
      data: { status: "INACTIVE" },
    });
    return "INACTIVE";
  }
  if (isRosterWindowOpen(league.rosterDeadline, now)) return league.status;
  if (!(await meetsActiveRequirements(league.id))) return league.status;
  await prisma.league.update({
    where: { id: league.id },
    data: { status: "ACTIVE" },
  });
  return "ACTIVE";
}

/** Initial status for a newly created / edited league. */
export function initialStatusForDeadline(
  rosterDeadline: Date | null,
  now = new Date(),
): "INACTIVE" | "REGISTRATION" {
  if (!rosterDeadline) return "INACTIVE";
  return isRosterWindowOpen(rosterDeadline, now) ? "REGISTRATION" : "INACTIVE";
}

/** Guard for manual transitions into REGISTRATION. */
export function assertRegistrationAllowed(
  rosterDeadline: Date | null,
  now = new Date(),
): void {
  if (!rosterDeadline) return;
  if (!isRosterWindowOpen(rosterDeadline, now)) {
    throw new AppError(
      409,
      messages.error.league.registrationRequiresValidDeadline,
    );
  }
}
export async function autoAdvanceExpiredRegistrations(now = new Date()): Promise<number> {
  const candidates = await prisma.league.findMany({
    where: {
      status: "REGISTRATION",
      rosterDeadline: { not: null },
    },
    select: { id: true, rosterDeadline: true },
  });

  const expiredIds = candidates
    .filter((l) => !isRosterWindowOpen(l.rosterDeadline, now))
    .map((l) => l.id);

  if (expiredIds.length === 0) return 0;

  let advanced = 0;
  for (const leagueId of expiredIds) {
    if (!(await meetsActiveRequirements(leagueId))) continue;

    await prisma.league.update({
      where: { id: leagueId },
      data: { status: "ACTIVE" },
    });
    advanced++;
  }
  return advanced;
}

export default { meetsActiveRequirements, maybeAdvanceSingleLeague, autoAdvanceExpiredRegistrations, initialStatusForDeadline, assertRegistrationAllowed };
