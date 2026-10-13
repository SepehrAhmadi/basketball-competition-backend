import prisma from "../../../config/db.config.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";
import { isPlayerAgeEligible } from "./league.rules.ts";
import { memberInclude } from "./league.mapper.ts";
import type { LeagueContext, LeagueTeamAccess } from "./league.types.ts";
import { findPlayerUserIdsInOtherTeams } from "./league.players.ts";
import { rosterRowPolicy, lockReasonMessage } from "../leagues.policy.ts";

export type AddableRow = {
  id: number;
  userId: number;
  role: string;
  isHeadCoach: boolean;
  user: { birthDate: Date | null };
};

/** Loads and validates the toggle permission of the requested rows. */
export async function loadAddableRows(
  ids: number[],
  teamId: number,
  seasonId: number,
  access: LeagueTeamAccess,
  league: LeagueContext,
): Promise<AddableRow[]> {
  const rows = await prisma.teamSeasonMember.findMany({
    where: {
      id: { in: ids },
      teamId,
      seasonId,
      status: "ACTIVE",
      user: { status: "ACTIVE" },
    },
    include: { user: { select: { id: true, birthDate: true } } },
  });
  if (rows.length !== ids.length) {
    const found = new Set(rows.map((r) => r.id));
    const missing = ids.filter((id) => !found.has(id));
    throw new AppError(
      404,
      `${messages.error.leagueRoster.teamMemberNotFound}: ${missing.join(", ")}`,
    );
  }

  for (const row of rows) {
    const decision = rosterRowPolicy(access, league, {
      teamSeasonMemberId: row.id,
      isHeadCoach: row.isHeadCoach,
    });
    if (!decision.canToggle)
      throw new AppError(403, lockReasonMessage(decision.lockReason));
  }
  return rows;
}

/** Enforces age eligibility and the one-team-per-league rule for players. */
export async function assertPlayersEligible(
  rows: AddableRow[],
  leagueId: number,
  leagueTeamId: number,
  minBirthDate: Date,
): Promise<void> {
  const playerUserIds = rows
    .filter((r) => r.role === "PLAYER")
    .map((r) => r.userId);
  const clashUserIds = await findPlayerUserIdsInOtherTeams(
    leagueId,
    leagueTeamId,
    playerUserIds,
  );

  for (const row of rows) {
    if (row.role !== "PLAYER") continue;
    const age = isPlayerAgeEligible(row.user.birthDate, minBirthDate);
    if (!age.ok) {
      throw new AppError(
        400,
        age.reason === "BIRTH_DATE_MISSING"
          ? messages.error.leagueRoster.birthDateRequired
          : messages.error.leagueRoster.ageIneligible,
      );
    }
    if (clashUserIds.has(row.userId))
      throw new AppError(409, messages.error.leagueRoster.playerInOtherTeam);
  }
}

/** Reactivates DELETED rows and creates missing ones, then reloads for output. */
export async function persistRosterRows(leagueTeamId: number, ids: number[]) {
  const existing = await prisma.leagueTeamMember.findMany({
    where: { leagueTeamId, teamSeasonMemberId: { in: ids } },
  });
  const byMemberId = new Map(existing.map((e) => [e.teamSeasonMemberId, e]));
  for (const id of ids) {
    if (byMemberId.get(id)?.status === "ACTIVE")
      throw new AppError(409, messages.error.leagueRoster.alreadyInRoster);
  }

  await prisma.$transaction(async (tx) => {
    const reactivateIds = existing.map((e) => e.id);
    if (reactivateIds.length > 0) {
      await tx.leagueTeamMember.updateMany({
        where: { id: { in: reactivateIds } },
        data: { status: "ACTIVE" },
      });
    }
    const missingIds = ids.filter((id) => !byMemberId.has(id));
    if (missingIds.length > 0) {
      await tx.leagueTeamMember.createMany({
        data: missingIds.map((teamSeasonMemberId) => ({
          leagueTeamId,
          teamSeasonMemberId,
          status: "ACTIVE",
        })),
      });
    }
  });
  const created = await prisma.leagueTeamMember.findMany({
    where: { leagueTeamId, teamSeasonMemberId: { in: ids } },
    include: memberInclude,
  });
  const byRequestedId = new Map(
    created.map((r) => [r.teamSeasonMemberId, r]),
  );
  return ids.map((id) => byRequestedId.get(id)!);
}
