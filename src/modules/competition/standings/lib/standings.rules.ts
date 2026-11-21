import type { GroupRoundType } from "../../../../prisma/generated/prisma/enums.ts";

export interface StandingsGame {
  homeLeagueTeamId: number;
  awayLeagueTeamId: number;
  homeScore: number;
  awayScore: number;
}

export interface StandingStats {
  played: number;
  won: number;
  lost: number;
  points: number;
  pointsFor: number;
  pointsAgainst: number;
  difference: number;
}

export interface RankedStanding extends StandingStats {
  leagueTeamId: number;
  rank: number;
}

export interface TiedRun {
  leagueTeamIds: number[];
  fromRank: number;
  toRank: number;
}

interface HeadToHead {
  points: number;
  difference: number;
}

function zeroStats(): StandingStats {
  return {
    played: 0,
    won: 0,
    lost: 0,
    points: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    difference: 0,
  };
}

function applyGame(
  stats: StandingStats,
  scored: number,
  conceded: number,
  tablePoints: number,
  isWinner: boolean,
): void {
  stats.played += 1;
  if (isWinner) stats.won += 1;
  else stats.lost += 1;
  stats.points += tablePoints;
  stats.pointsFor += scored;
  stats.pointsAgainst += conceded;
  stats.difference = stats.pointsFor - stats.pointsAgainst;
}

export function computeGroupStandings(input: {
  teamIds: number[];
  games: StandingsGame[];
  winPoints: number;
  lossPoints: number;
}): { rows: RankedStanding[]; unresolvedTies: TiedRun[]; gamesCounted: number } {
  const table = new Map<number, StandingStats>();
  for (const id of input.teamIds) table.set(id, zeroStats());

  const scored: StandingsGame[] = [];
  for (const game of input.games) {
    const home = table.get(game.homeLeagueTeamId);
    const away = table.get(game.awayLeagueTeamId);
    if (!home || !away) continue;
    if (game.homeScore === game.awayScore) continue;
    const homeWon = game.homeScore > game.awayScore;
    applyGame(
      home,
      game.homeScore,
      game.awayScore,
      homeWon ? input.winPoints : input.lossPoints,
      homeWon,
    );
    applyGame(
      away,
      game.awayScore,
      game.homeScore,
      homeWon ? input.lossPoints : input.winPoints,
      !homeWon,
    );
    scored.push(game);
  }

  const byPoints = [...table.entries()].sort(
    ([aId, a], [bId, b]) => b.points - a.points || aId - bId,
  );

  const rows: RankedStanding[] = [];
  const unresolvedTies: TiedRun[] = [];
  let rank = 1;
  let index = 0;
  while (index < byPoints.length) {
    const blockStart = index;
    while (
      index + 1 < byPoints.length &&
      byPoints[index + 1][1].points === byPoints[blockStart][1].points
    ) {
      index += 1;
    }
    const block = byPoints.slice(blockStart, index + 1);
    const blockIds = new Set(block.map(([id]) => id));
    const h2h = headToHeadFor(
      blockIds,
      scored,
      input.winPoints,
      input.lossPoints,
    );
    const ordered = block.length === 1 ? block : orderTiedBlock(block, h2h);
    for (const [leagueTeamId, stats] of ordered) {
      rows.push({ leagueTeamId, rank, ...stats });
      rank += 1;
    }
    collectUnresolvedTies(ordered, h2h, rank - ordered.length, unresolvedTies);
    index += 1;
  }

  return { rows, unresolvedTies, gamesCounted: scored.length };
}

function headToHeadFor(
  blockIds: Set<number>,
  games: StandingsGame[],
  winPoints: number,
  lossPoints: number,
): Map<number, HeadToHead> {
  const result = new Map<number, HeadToHead>();
  for (const id of blockIds) result.set(id, { points: 0, difference: 0 });
  for (const game of games) {
    if (!blockIds.has(game.homeLeagueTeamId)) continue;
    if (!blockIds.has(game.awayLeagueTeamId)) continue;
    if (game.homeScore === game.awayScore) continue;
    const homeWon = game.homeScore > game.awayScore;
    const home = result.get(game.homeLeagueTeamId);
    const away = result.get(game.awayLeagueTeamId);
    if (!home || !away) continue;
    home.points += homeWon ? winPoints : lossPoints;
    away.points += homeWon ? lossPoints : winPoints;
    home.difference += game.homeScore - game.awayScore;
    away.difference += game.awayScore - game.homeScore;
  }
  return result;
}

function orderTiedBlock(
  block: [number, StandingStats][],
  h2h: Map<number, HeadToHead>,
): [number, StandingStats][] {
  return [...block].sort(([aId, a], [bId, b]) => {
    const ha = h2h.get(aId) ?? { points: 0, difference: 0 };
    const hb = h2h.get(bId) ?? { points: 0, difference: 0 };
    return (
      hb.points - ha.points ||
      hb.difference - ha.difference ||
      b.difference - a.difference ||
      b.pointsFor - a.pointsFor ||
      aId - bId
    );
  });
}

function tieKey(
  id: number,
  stats: StandingStats,
  h2h: Map<number, HeadToHead>,
): string {
  const h = h2h.get(id) ?? { points: 0, difference: 0 };
  return `${h.points}|${h.difference}|${stats.difference}|${stats.pointsFor}`;
}

function collectUnresolvedTies(
  ordered: [number, StandingStats][],
  h2h: Map<number, HeadToHead>,
  runStart: number,
  out: TiedRun[],
): void {
  let start = 0;
  while (start < ordered.length) {
    let end = start;
    while (
      end + 1 < ordered.length &&
      tieKey(ordered[end + 1][0], ordered[end + 1][1], h2h) ===
        tieKey(ordered[start][0], ordered[start][1], h2h)
    ) {
      end += 1;
    }
    if (end > start) {
      const runIds = ordered.slice(start, end + 1).map(([id]) => id);
      const anyPlayed = runIds.some(
        (id) => (ordered.find(([oId]) => oId === id)?.[1].played ?? 0) > 0,
      );
      if (anyPlayed) {
        out.push({
          leagueTeamIds: runIds,
          fromRank: runStart + start,
          toRank: runStart + end,
        });
      }
    }
    start = end + 1;
  }
}

export function expectedGroupGames(
  teamsCount: number,
  roundType: GroupRoundType | null,
): number {
  if (teamsCount < 2) return 0;
  const single = (teamsCount * (teamsCount - 1)) / 2;
  return roundType === "DOUBLE_ROUND" ? single * 2 : single;
}

export function isGroupComplete(
  teamsCount: number,
  roundType: GroupRoundType | null,
  finishedGamesCount: number,
): boolean {
  return (
    teamsCount >= 2 &&
    finishedGamesCount >= expectedGroupGames(teamsCount, roundType)
  );
}
