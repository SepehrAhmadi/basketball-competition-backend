import prisma from "../../../config/db.config.ts";

export type TransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

/**
 * Activates roster rows for the given targets in batch: one updateMany for
 * existing rows plus one createMany (skipDuplicates) for missing ones.
 */
async function activateRosterRows(
  tx: TransactionClient,
  targets: { leagueTeamId: number; teamSeasonMemberId: number }[],
): Promise<void> {
  if (targets.length === 0) return;
  const leagueTeamIds = [...new Set(targets.map((t) => t.leagueTeamId))];
  const memberIds = [...new Set(targets.map((t) => t.teamSeasonMemberId))];
  const existing = await tx.leagueTeamMember.findMany({
    where: { leagueTeamId: { in: leagueTeamIds }, teamSeasonMemberId: { in: memberIds } },
    select: { id: true, leagueTeamId: true, teamSeasonMemberId: true },
  });
  const existingKeys = new Set(
    existing.map((e) => `${e.leagueTeamId}:${e.teamSeasonMemberId}`),
  );
  const existingIds = existing.map((e) => e.id);
  if (existingIds.length > 0) {
    await tx.leagueTeamMember.updateMany({
      where: { id: { in: existingIds } },
      data: { status: "ACTIVE" },
    });
  }
  const missing = targets.filter(
    (t) => !existingKeys.has(`${t.leagueTeamId}:${t.teamSeasonMemberId}`),
  );
  if (missing.length > 0) {
    await tx.leagueTeamMember.createMany({
      data: missing.map((t) => ({
        leagueTeamId: t.leagueTeamId,
        teamSeasonMemberId: t.teamSeasonMemberId,
        status: "ACTIVE",
      })),
      skipDuplicates: true,
    });
  }
}

/**
 * Adds the team's ACTIVE head coach for `seasonId` to the league roster.
 * No-op when the team has no head coach.
 */
export async function addHeadCoachToLeagueRoster(
  tx: TransactionClient,
  params: { leagueTeamId: number; teamId: number; seasonId: number },
): Promise<void> {
  const headCoach = await tx.teamSeasonMember.findFirst({
    where: {
      teamId: params.teamId,
      seasonId: params.seasonId,
      role: "COACH",
      isHeadCoach: true,
      status: "ACTIVE",
      user: { status: "ACTIVE" },
    },
    select: { id: true },
  });
  if (!headCoach) return;
  await activateRosterRows(tx, [
    { leagueTeamId: params.leagueTeamId, teamSeasonMemberId: headCoach.id },
  ]);
}

/**
 * After a team-level head-coach assignment: adds the member to every ACTIVE
 * league registration of the team whose league is in REGISTRATION and belongs
 * to `seasonId`.
 */
export async function syncHeadCoachToRegistrationLeagues(
  tx: TransactionClient,
  params: { teamId: number; seasonId: number; teamSeasonMemberId: number },
): Promise<void> {
  const leagueTeams = await tx.leagueTeam.findMany({
    where: {
      teamId: params.teamId,
      status: "ACTIVE",
      league: {
        status: "REGISTRATION",
        ageCategoryCutoff: { seasonId: params.seasonId },
      },
    },
    select: { id: true },
  });
  await activateRosterRows(
    tx,
    leagueTeams.map((lt) => ({
      leagueTeamId: lt.id,
      teamSeasonMemberId: params.teamSeasonMemberId,
    })),
  );
}


