import prisma from "../../../config/db.config.ts";

/**
 * Player userIds already registered in another ACTIVE team of the same
 * league. Returns an empty set without querying when there is nothing
 * to look up.
 */
export async function findPlayerUserIdsInOtherTeams(
  leagueId: number,
  excludeLeagueTeamId: number,
  userIds: number[],
): Promise<Set<number>> {
  if (userIds.length === 0) return new Set();
  const rows = await prisma.leagueTeamMember.findMany({
    where: {
      status: "ACTIVE",
      leagueTeam: {
        leagueId,
        status: "ACTIVE",
        id: { not: excludeLeagueTeamId },
      },
      teamSeasonMember: { role: "PLAYER", userId: { in: userIds } },
    },
    select: { teamSeasonMember: { select: { userId: true } } },
  });
  return new Set(rows.map((r) => r.teamSeasonMember.userId));
}
