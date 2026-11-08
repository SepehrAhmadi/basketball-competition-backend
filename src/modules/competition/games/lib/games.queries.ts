import prisma from "../../../../config/db.config.ts";
import type { Prisma } from "../../../../prisma/generated/prisma/client.ts";
import type { GameStatus } from "../../../../prisma/generated/prisma/enums.ts";
import {
  jalaliToGregorianOrNull,
  tehranDayStart,
} from "../../../../utils/date.util.ts";

export const gameTeamInclude = {
  team: {
    select: {
      id: true,
      name: true,
      logoUrl: true,
      status: true,
      organization: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.LeagueTeamInclude;

export type GameTeamRow = Prisma.LeagueTeamGetPayload<{
  include: typeof gameTeamInclude;
}>;

export const gameInclude = {
  group: { select: { id: true, name: true } },
  homeTeam: { include: gameTeamInclude },
  awayTeam: { include: gameTeamInclude },
  rescheduledFrom: { select: { id: true, status: true } },
  rescheduledTo: { select: { id: true, status: true } },
} satisfies Prisma.GameInclude;

export type GameRow = Prisma.GameGetPayload<{ include: typeof gameInclude }>;

export interface GamesListQuery {
  page: number;
  pageSize: number;
  status?: GameStatus;
  groupId?: number;
  leagueTeamId?: number;
  dateFrom?: string;
  dateTo?: string;
}

export function buildGamesWhere(
  leagueId: number,
  query: GamesListQuery,
): Prisma.GameWhereInput {
  return {
    leagueId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.groupId ? { groupId: query.groupId } : {}),
    ...(query.leagueTeamId
      ? {
          OR: [
            { homeLeagueTeamId: query.leagueTeamId },
            { awayLeagueTeamId: query.leagueTeamId },
          ],
        }
      : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          scheduledDate: {
            ...(query.dateFrom
              ? { gte: jalaliToGregorianOrNull(query.dateFrom)! }
              : {}),
            ...(query.dateTo
              ? { lte: jalaliToGregorianOrNull(query.dateTo)! }
              : {}),
          },
        }
      : {}),
  };
}

export const gamesOrderBy: Prisma.GameOrderByWithRelationInput[] = [
  { scheduledDate: "asc" },
  { scheduledTime: "asc" },
  { id: "asc" },
];

const pairGameSelect = {
  id: true,
  homeLeagueTeamId: true,
  awayLeagueTeamId: true,
} satisfies Prisma.GameSelect;

/**
 * Non-canceled games among the teams of the given rows (a superset of the
 * rows' pairs; `notSwappedGameIds` groups by pair so extras are harmless).
 */
export function loadPairGames(
  leagueId: number,
  rows: { homeLeagueTeamId: number; awayLeagueTeamId: number }[],
) {
  if (rows.length === 0) return Promise.resolve([]);
  const ids = [
    ...new Set(rows.flatMap((r) => [r.homeLeagueTeamId, r.awayLeagueTeamId])),
  ];
  return prisma.game.findMany({
    where: {
      leagueId,
      status: { not: "CANCELED" },
      homeLeagueTeamId: { in: ids },
      awayLeagueTeamId: { in: ids },
    },
    select: pairGameSelect,
    orderBy: { id: "asc" },
  });
}

export function countGamesByStatus(leagueId: number) {
  return prisma.game.groupBy({
    by: ["status"],
    where: { leagueId },
    orderBy: { status: "asc" },
    _count: { _all: true },
  });
}

export function countResultPending(leagueId: number, now: Date = new Date()) {
  return prisma.game.count({
    where: {
      leagueId,
      status: { in: ["SCHEDULED", "LIVE"] },
      scheduledDate: { lt: tehranDayStart(now) },
    },
  });
}
