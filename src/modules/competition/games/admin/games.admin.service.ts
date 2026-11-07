import prisma from "../../../../config/db.config.ts";
import AppError from "../../../../utils/appError.ts";
import { messages } from "../../../../language/message.ts";
import { isGroupedFormat } from "../../format/lib/format.rules.ts";
import {
  loadActiveLeagueTeam,
  loadCompetitionLeague,
  unwrap,
  type CompetitionLeague,
} from "../../lib/competition.access.ts";
import {
  buildResultData,
  evaluateGameActions,
  evaluatePairQuota,
  getGamesLockReason,
  notSwappedGameIds,
  type PairGame,
  type ResultDenial,
  type ResultInput,
} from "../lib/games.rules.ts";
import {
  buildGamesLock,
  buildUnfinishedGamesIssues,
} from "../lib/games.advisories.ts";
import {
  buildGamesWhere,
  countGamesByStatus,
  countResultPending,
  gameInclude,
  gamesOrderBy,
  loadPairGames,
  type GameRow,
  type GamesListQuery,
} from "../lib/games.queries.ts";
import { toAdminGameItem } from "../lib/games.mapper.ts";
import type {
  GameStatus,
  GroupRoundType,
} from "../../../../prisma/generated/prisma/enums.ts";
import { jalaliToGregorianOrNull } from "../../../../utils/date.util.ts";
import {
  assertGamesCreatable,
  loadGame,
  loadGameWriteContext,
  loadRescheduleSource,
  throwGameDenial,
} from "../lib/games.access.ts";

interface CreateGameInput {
  homeLeagueTeamId: number;
  awayLeagueTeamId: number;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  rescheduledFromGameId?: number | null;
}

const RESULT_DENIAL_MESSAGES: Record<ResultDenial, string> = {
  SCORE_INVALID: messages.error.game.scoreInvalid,
  TIE_NOT_ALLOWED: messages.error.game.tieNotAllowed,
  FORFEIT_TEAM_INVALID: messages.error.game.forfeitTeamInvalid,
};

async function notSwappedFor(
  league: CompetitionLeague,
  rows: GameRow[],
): Promise<Set<number>> {
  if (league.groupRoundType !== "DOUBLE_ROUND") return new Set();
  const pairGames = await loadPairGames(league.id, rows);
  return notSwappedGameIds(pairGames, league.groupRoundType);
}

function toItem(
  league: CompetitionLeague,
  row: GameRow,
  notSwappedIds: ReadonlySet<number>,
) {
  return toAdminGameItem(row, {
    leagueStatus: league.status,
    leagueStartDate: league.startDate,
    leagueEndDate: league.endDate,
    notSwappedIds,
  });
}

async function toItemWithPairs(league: CompetitionLeague, row: GameRow) {
  return toItem(league, row, await notSwappedFor(league, [row]));
}


function emptySummary() {
  return {
    byStatus: { SCHEDULED: 0, LIVE: 0, FINISHED: 0, CANCELED: 0 },
    resultPending: 0,
    unfinished: 0,
    issues: [],
  };
}

async function listGames(leagueId: number, query: GamesListQuery) {
  const league = await loadCompetitionLeague(leagueId);
  const lock = buildGamesLock(
    getGamesLockReason({ status: league.status, format: league.format }),
  );
  const header = { league: { id: league.id, format: league.format }, lock };
  if (!isGroupedFormat(league.format)) {
    return {
      ...header,
      items: [],
      total: 0,
      page: query.page,
      pageSize: query.pageSize,
      summary: emptySummary(),
    };
  }
  const where = buildGamesWhere(leagueId, query);
  const [rows, total, statusCounts, resultPending] = await prisma.$transaction([
    prisma.game.findMany({
      where,
      orderBy: gamesOrderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: gameInclude,
    }),
    prisma.game.count({ where }),
    countGamesByStatus(leagueId),
    countResultPending(leagueId),
  ]);
  const notSwappedIds = await notSwappedFor(league, rows);
  const byStatus: Record<GameStatus, number> = {
    SCHEDULED: 0,
    LIVE: 0,
    FINISHED: 0,
    CANCELED: 0,
  };
  for (const entry of statusCounts) {
    const count = entry._count;
    byStatus[entry.status] =
      typeof count === "object" && count !== null ? (count._all ?? 0) : 0;
  }
  const unfinished = byStatus.SCHEDULED + byStatus.LIVE;
  return {
    ...header,
    items: rows.map((row) => toItem(league, row, notSwappedIds)),
    total,
    page: query.page,
    pageSize: query.pageSize,
    summary: {
      byStatus,
      resultPending,
      unfinished,
      issues: buildUnfinishedGamesIssues(unfinished),
    },
  };
}

async function getGame(leagueId: number, gameId: number) {
  const [league, game] = await Promise.allSettled([
    loadCompetitionLeague(leagueId),
    loadGame(leagueId, gameId),
  ]);
  const loadedLeague = unwrap(league);
  return toItemWithPairs(loadedLeague, unwrap(game));
}

async function createGame(leagueId: number, input: CreateGameInput) {
  const league = await loadCompetitionLeague(leagueId);
  assertGamesCreatable(league);

  const [home, away] = await Promise.allSettled([
    loadActiveLeagueTeam(leagueId, input.homeLeagueTeamId),
    loadActiveLeagueTeam(leagueId, input.awayLeagueTeamId),
  ]);
  unwrap(home);
  unwrap(away);

  if (input.homeLeagueTeamId === input.awayLeagueTeamId)
    throw new AppError(400, messages.error.game.sameTeam);

  const memberships = await prisma.groupTeam.findMany({
    where: {
      leagueTeamId: {
        in: [input.homeLeagueTeamId, input.awayLeagueTeamId],
      },
      group: { leagueId },
    },
    select: { groupId: true, leagueTeamId: true },
  });
  const homeMembership = memberships.find(
    (m) => m.leagueTeamId === input.homeLeagueTeamId,
  );
  const awayMembership = memberships.find(
    (m) => m.leagueTeamId === input.awayLeagueTeamId,
  );
  if (!homeMembership || !awayMembership)
    throw new AppError(400, messages.error.game.teamNotGrouped);
  if (homeMembership.groupId !== awayMembership.groupId)
    throw new AppError(400, messages.error.game.teamsNotInSameGroup);
  const groupId = homeMembership.groupId;

  const existingPair: PairGame[] = await loadPairGames(leagueId, [
    {
      homeLeagueTeamId: input.homeLeagueTeamId,
      awayLeagueTeamId: input.awayLeagueTeamId,
    },
  ]);
  const quota = evaluatePairQuota(
    existingPair.length,
    (league.groupRoundType ?? "ONE_ROUND") as GroupRoundType,
  );
  if (!quota.allowed)
    throw new AppError(409, messages.error.game.pairLimitReached);

  if (input.rescheduledFromGameId != null) {
    await loadRescheduleSource(
      leagueId,
      input.rescheduledFromGameId,
      input.homeLeagueTeamId,
      input.awayLeagueTeamId,
    );
  }

  let created: GameRow;
  try {
    created = await prisma.game.create({
      data: {
        leagueId,
        groupId,
        homeLeagueTeamId: input.homeLeagueTeamId,
        awayLeagueTeamId: input.awayLeagueTeamId,
        scheduledDate: jalaliToGregorianOrNull(input.scheduledDate),
        scheduledTime: input.scheduledTime ?? null,
        rescheduledFromGameId: input.rescheduledFromGameId ?? null,
      },
      include: gameInclude,
    });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "P2002")
      throw new AppError(409, messages.error.game.alreadyRescheduled);
    throw err;
  }
  const notSwappedIds = notSwappedGameIds(
    [...existingPair, created],
    league.groupRoundType,
  );
  return toItem(league, created, notSwappedIds);
}

async function updateSchedule(
  leagueId: number,
  gameId: number,
  input: { scheduledDate?: string | null; scheduledTime?: string | null },
) {
  const { league, game } = await loadGameWriteContext(leagueId, gameId);
  const actions = evaluateGameActions({
    status: game.status,
    leagueStatus: league.status,
    hasReplacement: game.rescheduledTo !== null,
  });
  throwGameDenial("schedule", actions.schedule);
  const data: { scheduledDate?: Date | null; scheduledTime?: string | null } =
    {};
  if (input.scheduledDate !== undefined)
    data.scheduledDate = jalaliToGregorianOrNull(input.scheduledDate);
  if (input.scheduledTime !== undefined)
    data.scheduledTime = input.scheduledTime;
  const updated = await prisma.game.update({
    where: { id: gameId },
    data,
    include: gameInclude,
  });
  return toItemWithPairs(league, updated);
}

async function updateStatus(
  leagueId: number,
  gameId: number,
  input: { status: "LIVE" | "CANCELED"; cancelReason?: string | null },
) {
  const { league, game } = await loadGameWriteContext(leagueId, gameId);
  const actions = evaluateGameActions({
    status: game.status,
    leagueStatus: league.status,
    hasReplacement: game.rescheduledTo !== null,
  });
  if (input.status === "LIVE") throwGameDenial("start", actions.start);
  else throwGameDenial("cancel", actions.cancel);
  const updated = await prisma.game.update({
    where: { id: gameId },
    data: {
      status: input.status,
      ...(input.status === "CANCELED"
        ? { cancelReason: input.cancelReason ?? null }
        : {}),
    },
    include: gameInclude,
  });
  return toItemWithPairs(league, updated);
}

async function enterResult(
  leagueId: number,
  gameId: number,
  input: ResultInput,
) {
  const { league, game } = await loadGameWriteContext(leagueId, gameId);
  const actions = evaluateGameActions({
    status: game.status,
    leagueStatus: league.status,
    hasReplacement: game.rescheduledTo !== null,
  });
  throwGameDenial("result", actions.result);
  const built = buildResultData(input, {
    homeLeagueTeamId: game.homeLeagueTeamId,
    awayLeagueTeamId: game.awayLeagueTeamId,
  });
  if (!built.ok)
    throw new AppError(400, RESULT_DENIAL_MESSAGES[built.reason]);
  const updated = await prisma.game.update({
    where: { id: gameId },
    data: {
      ...built.data,
      status: "FINISHED",
      cancelReason: null,
      resultNote: input.resultNote ?? null,
    },
    include: gameInclude,
  });
  return toItemWithPairs(league, updated);
}

async function clearResult(leagueId: number, gameId: number) {
  const { league, game } = await loadGameWriteContext(leagueId, gameId);
  const actions = evaluateGameActions({
    status: game.status,
    leagueStatus: league.status,
    hasReplacement: game.rescheduledTo !== null,
  });
  throwGameDenial("result", actions.result);
  if (game.status !== "FINISHED")
    throw new AppError(409, messages.error.game.noResultToClear);
  const updated = await prisma.game.update({
    where: { id: gameId },
    data: {
      status: "SCHEDULED",
      homeScore: null,
      awayScore: null,
      resultType: null,
      forfeitLeagueTeamId: null,
      resultNote: null,
    },
    include: gameInclude,
  });
  return toItemWithPairs(league, updated);
}

async function deleteGame(leagueId: number, gameId: number) {
  const { league, game } = await loadGameWriteContext(leagueId, gameId);
  const actions = evaluateGameActions({
    status: game.status,
    leagueStatus: league.status,
    hasReplacement: game.rescheduledTo !== null,
  });
  throwGameDenial("delete", actions.delete);
  await prisma.game.delete({ where: { id: gameId } });
  return { id: gameId };
}

export default {
  listGames,
  getGame,
  createGame,
  updateSchedule,
  updateStatus,
  enterResult,
  clearResult,
  deleteGame,
};
