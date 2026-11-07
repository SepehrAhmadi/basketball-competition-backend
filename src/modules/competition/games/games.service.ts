import prisma from "../../../config/db.config.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";
import type { Actor } from "../../../authz/actor.ts";
import { isGroupedFormat } from "../format/lib/format.rules.ts";
import { loadCompetitionLeague } from "../lib/competition.access.ts";
import { jalaliToGregorianOrNull } from "../../../utils/date.util.ts";
import { gameInclude, gameListInclude } from "./lib/games.queries.ts";
import { toGameItem } from "./lib/games.mapper.ts";
import type { GameStatus } from "../../../prisma/generated/prisma/enums.ts";

interface PublicGamesQuery {
  page: number;
  pageSize: number;
  status?: GameStatus;
  groupId?: number;
  leagueTeamId?: number;
  dateFrom?: string;
  dateTo?: string;
}

async function listPublicGames(leagueId: number, query: PublicGamesQuery, actor: Actor) {
  const league = await loadCompetitionLeague(leagueId, {
    hideInactiveFrom: actor,
  });
  if (!isGroupedFormat(league.format)) {
    return { format: league.format, items: [], total: 0, page: query.page, pageSize: query.pageSize };
  }
  const where = {
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
  const [rows, total] = await prisma.$transaction([
    prisma.game.findMany({
      where,
      orderBy: [{ scheduledDate: "asc" }, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: gameListInclude,
    }),
    prisma.game.count({ where }),
  ]);
  return {
    format: league.format,
    items: rows.map(toGameItem),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function getPublicGame(leagueId: number, gameId: number, actor: Actor) {
  await loadCompetitionLeague(leagueId, { hideInactiveFrom: actor });
  const game = await prisma.game.findFirst({
    where: { id: gameId, leagueId },
    include: gameInclude,
  });
  if (!game) throw new AppError(404, messages.error.game.notFound);
  return toGameItem(game);
}

export default { listPublicGames, getPublicGame };
