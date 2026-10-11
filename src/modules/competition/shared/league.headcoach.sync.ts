import prisma from "../../../config/db.config.ts";

export type TransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

async function activateRosterRow(
  tx: TransactionClient,
  leagueTeamId: number,
  teamSeasonMemberId: number,
) {
  await tx.leagueTeamMember.upsert({
    where: { leagueTeamId_teamSeasonMemberId: { leagueTeamId, teamSeasonMemberId } },
    create: { leagueTeamId, teamSeasonMemberId, status: "ACTIVE" },
    update: { status: "ACTIVE" },
  });
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
  await activateRosterRow(tx, params.leagueTeamId, headCoach.id);
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
  for (const lt of leagueTeams) {
    await activateRosterRow(tx, lt.id, params.teamSeasonMemberId);
  }
}

export default {
  addHeadCoachToLeagueRoster,
  syncHeadCoachToRegistrationLeagues,
};
