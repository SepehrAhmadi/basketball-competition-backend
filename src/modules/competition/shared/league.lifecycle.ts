import prisma from "../../../config/db.config.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";
import { isRosterWindowOpen } from "./league.rules.ts";

/**
 * Lifecycle rule (single description for the whole module):
 * - REGISTRATION always has a today-or-future deadline (enforced by
 *   assertRegistrationAllowed; clearing the deadline moves REGISTRATION
 *   back to INACTIVE via updateLeague).
 * - Deadline today/future  → REGISTRATION (window open).
 * - Deadline past          → ACTIVE (window closed), if ACTIVE requirements
 *   hold (≥2 teams, each with ≥1 player). Otherwise stays REGISTRATION.
 * Promotion is owned by the background job (advanceExpiredRegistrations);
 * reads never write. Manual status changes by an admin always remain
 * possible (override), except FINISHED which only SUPER_ADMIN may reopen.
 */
export type ActiveRequirementReason = "MIN_TEAMS" | "TEAM_WITHOUT_PLAYERS";

/** Pure: evaluates the ACTIVE requirements from grouped player counts. */
export function evaluateActiveRequirements(
  playerCounts: number[],
): { ok: true } | { ok: false; reason: ActiveRequirementReason } {
  if (playerCounts.length < 2) return { ok: false, reason: "MIN_TEAMS" };
  if (playerCounts.some((count) => count === 0))
    return { ok: false, reason: "TEAM_WITHOUT_PLAYERS" };
  return { ok: true };
}

/** Single source for "can this league become ACTIVE?". */
export async function checkActiveRequirements(
  leagueId: number,
): Promise<{ ok: true } | { ok: false; reason: ActiveRequirementReason }> {
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
  return evaluateActiveRequirements(teams.map((t) => t._count.members));
}

/** Initial status for a newly created / edited league. */
export function initialStatusForDeadline(
  rosterDeadline: Date | null,
  now = new Date(),
): "INACTIVE" | "REGISTRATION" {
  if (!rosterDeadline) return "INACTIVE";
  return isRosterWindowOpen(rosterDeadline, now) ? "REGISTRATION" : "INACTIVE";
}

/** Guard for manual transitions into REGISTRATION: a today-or-future deadline is required. */
export function assertRegistrationAllowed(
  rosterDeadline: Date | null,
  now = new Date(),
): void {
  if (!rosterDeadline || !isRosterWindowOpen(rosterDeadline, now)) {
    throw new AppError(
      409,
      messages.error.league.registrationRequiresValidDeadline,
    );
  }
}
/**
 * Promotes every REGISTRATION league whose deadline passed and whose ACTIVE
 * requirements hold. Batched: one query for expired leagues, one query for
 * all of their teams' player counts, one conditional write. The conditional
 * write (`status: "REGISTRATION"`) makes concurrent runs idempotent.
 */
export async function advanceExpiredRegistrations(
  now = new Date(),
): Promise<number> {
  // "Today in Tehran" as a UTC-midnight boundary: a deadline stored at UTC
  // noon compares exactly like the JS `isRosterWindowOpen` day comparison.
  const todayTehran = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
  }).format(now);
  const expiredBefore = new Date(`${todayTehran}T00:00:00Z`);

  const expired = await prisma.league.findMany({
    where: {
      status: "REGISTRATION",
      rosterDeadline: { lt: expiredBefore },
    },
    select: { id: true },
  });
  if (expired.length === 0) return 0;
  const expiredIds = expired.map((l) => l.id);

  const teams = await prisma.leagueTeam.findMany({
    where: {
      leagueId: { in: expiredIds },
      status: "ACTIVE",
      team: { status: { not: "DELETED" } },
    },
    select: {
      leagueId: true,
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
  const countsByLeague = new Map<number, number[]>();
  for (const t of teams) {
    const list = countsByLeague.get(t.leagueId);
    if (list) list.push(t._count.members);
    else countsByLeague.set(t.leagueId, [t._count.members]);
  }

  const promotable = expiredIds.filter((id) =>
    evaluateActiveRequirements(countsByLeague.get(id) ?? []).ok,
  );
  if (promotable.length === 0) return 0;

  const result = await prisma.league.updateMany({
    where: { id: { in: promotable }, status: "REGISTRATION" },
    data: { status: "ACTIVE" },
  });
  // Hook: invalidate league caches here once caching is introduced.
  return result.count;
}

/**
 * Post-write promotion for a single league (e.g. after the deadline moves
 * to the past in updateLeague). Reads never call this.
 */
export async function advanceLeagueIfExpired(
  leagueId: number,
  now = new Date(),
): Promise<void> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, status: true, rosterDeadline: true },
  });
  if (
    !league ||
    league.status !== "REGISTRATION" ||
    !league.rosterDeadline ||
    isRosterWindowOpen(league.rosterDeadline, now)
  )
    return;
  if (!(await checkActiveRequirements(league.id)).ok) return;
  await prisma.league.updateMany({
    where: { id: league.id, status: "REGISTRATION" },
    data: { status: "ACTIVE" },
  });
  // Hook: invalidate league caches here once caching is introduced.
}

let lifecycleJobRunning = false;

/**
 * Owns REGISTRATION → ACTIVE promotion. Runs once at startup, then on the
 * interval. Guarded against overlapping runs; errors are logged.
 * Kept as one function so it can later move to node-cron or an external
 * scheduler without touching callers.
 */
export function startLeagueLifecycleJob(intervalMs: number): void {
  const tick = () => {
    if (lifecycleJobRunning) return;
    lifecycleJobRunning = true;
    advanceExpiredRegistrations()
      .catch((err) => {
        console.error("[league-lifecycle]", err);
      })
      .finally(() => {
        lifecycleJobRunning = false;
      });
  };
  tick();
  setInterval(tick, intervalMs).unref?.();
}
