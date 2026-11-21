import prisma from "../../../../config/db.config.ts";
import type { StandingsGame } from "./standings.rules.ts";

export async function loadFinishedGroupGames(
  leagueId: number,
  groupIds?: number[],
): Promise<Map<number, StandingsGame[]>> {
  const rows = await prisma.game.findMany({
    where: {
      leagueId,
      status: "FINISHED",
      groupId: groupIds ? { in: groupIds } : { not: null },
    },
    select: {
      groupId: true,
      homeLeagueTeamId: true,
      awayLeagueTeamId: true,
      homeScore: true,
      awayScore: true,
    },
  });
  const byGroup = new Map<number, StandingsGame[]>();
  for (const row of rows) {
    if (row.groupId === null) continue;
    if (row.homeScore === null || row.awayScore === null) continue;
    const list = byGroup.get(row.groupId) ?? [];
    list.push({
      homeLeagueTeamId: row.homeLeagueTeamId,
      awayLeagueTeamId: row.awayLeagueTeamId,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
    });
    byGroup.set(row.groupId, list);
  }
  return byGroup;
}
