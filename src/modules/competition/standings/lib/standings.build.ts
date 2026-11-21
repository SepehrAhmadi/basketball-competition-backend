import type { Advisory } from "../../../../shared/advisory.ts";
import type { GroupRoundType } from "../../../../prisma/generated/prisma/enums.ts";
import {
  computeGroupStandings,
  isGroupComplete,
  type StandingStats,
} from "./standings.rules.ts";
import type { StandingsGame } from "./standings.rules.ts";
import { loadFinishedGroupGames } from "./standings.queries.ts";
import {
  buildUnresolvedTieIssues,
  type StandingsIssueCode,
} from "./standings.advisories.ts";

export type StandingRow<T extends { leagueTeamId: number }> = T &
  StandingStats & {
    rank: number;
    qualified: boolean;
  };

export async function buildGroupsStandings<
  T extends { leagueTeamId: number },
>(input: {
  league: {
    id: number;
    winPoints: number;
    lossPoints: number;
    groupRoundType: GroupRoundType | null;
  };
  groups: { id: number; name: string; qualifiers: number | null; teams: T[] }[];
}): Promise<
  Map<number, { standings: StandingRow<T>[]; tieIssues: Advisory<StandingsIssueCode>[] }>
> {
  const groupIds = input.groups.map((g) => g.id);
  const gamesByGroup =
    groupIds.length === 0
      ? new Map<number, StandingsGame[]>()
      : await loadFinishedGroupGames(input.league.id, groupIds);
  const result = new Map<
    number,
    { standings: StandingRow<T>[]; tieIssues: Advisory<StandingsIssueCode>[] }
  >();
  for (const group of input.groups) {
    const teamIds = group.teams.map((t) => t.leagueTeamId);
    if (teamIds.length === 0) {
      result.set(group.id, { standings: [], tieIssues: [] });
      continue;
    }
    const { rows, unresolvedTies, gamesCounted } = computeGroupStandings({
      teamIds,
      games: gamesByGroup.get(group.id) ?? [],
      winPoints: input.league.winPoints,
      lossPoints: input.league.lossPoints,
    });
    const byId = new Map(rows.map((row) => [row.leagueTeamId, row]));
    const standings = group.teams.map((team) => {
      const row = byId.get(team.leagueTeamId);
      if (!row) throw new Error(`Missing standings row for ${team.leagueTeamId}`);
      return {
        ...team,
        played: row.played,
        won: row.won,
        lost: row.lost,
        points: row.points,
        pointsFor: row.pointsFor,
        pointsAgainst: row.pointsAgainst,
        difference: row.difference,
        rank: row.rank,
        qualified: group.qualifiers !== null && row.rank <= group.qualifiers,
      };
    });
    standings.sort((a, b) => a.rank - b.rank);
    const complete = isGroupComplete(
      group.teams.length,
      input.league.groupRoundType,
      gamesCounted,
    );
    const tieIssues = complete
      ? buildUnresolvedTieIssues(
          { id: group.id, name: group.name },
          unresolvedTies,
        )
      : [];
    result.set(group.id, { standings, tieIssues });
  }
  return result;
}
