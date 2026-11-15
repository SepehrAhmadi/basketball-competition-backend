import prisma from "../../../config/db.config.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";
import type { Actor } from "../../../authz/actor.ts";
import { isGroupedFormat } from "../format/lib/format.rules.ts";
import { loadCompetitionLeague } from "../lib/competition.access.ts";
import {
  buildGamesWhere,
  gameInclude,
  gamesOrderBy,
  type GamesListQuery,
} from "./lib/games.queries.ts";
import { toPublicGameItem } from "./lib/games.mapper.ts";

async function listPublicGames(
  leagueId: number,
  query: GamesListQuery,
  actor: Actor,
) {
  const league = await loadCompetitionLeague(leagueId, {
    hideInactiveFrom: actor,
  });
  if (!isGroupedFormat(league.format)) {
    return {
      format: league.format,
      items: [],
      total: 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  const where = buildGamesWhere(leagueId, query);
  const [rows, total] = await prisma.$transaction([
    prisma.game.findMany({
      where,
      orderBy: gamesOrderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: gameInclude,
    }),
    prisma.game.count({ where }),
  ]);
  const includeTeamStatus = league.status === "FINISHED";
  return {
    format: league.format,
    items: rows.map((row) => toPublicGameItem(row, { includeTeamStatus })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function getPublicGame(leagueId: number, gameId: number, actor: Actor) {
  const league = await loadCompetitionLeague(leagueId, {
    hideInactiveFrom: actor,
  });
  const game = await prisma.game.findFirst({
    where: { id: gameId, leagueId },
    include: gameInclude,
  });
  if (!game) throw new AppError(404, messages.error.game.notFound);
  return toPublicGameItem(game, {
    includeTeamStatus: league.status === "FINISHED",
  });
}

export default { listPublicGames, getPublicGame };
