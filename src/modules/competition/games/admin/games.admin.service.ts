import prisma from "../../../../config/db.config.ts";
import AppError from "../../../../utils/appError.ts";
import { messages } from "../../../../language/message.ts";
import { isGroupedFormat } from "../../format/lib/format.rules.ts";
import { isLeagueFinished } from "../../../leagues/lib/league.rules.ts";
import {
  loadActiveLeagueTeam,
  loadCompetitionLeague,
  unwrap,
} from "../../lib/competition.access.ts";
import {
  evaluateNormalResult,
  evaluatePairQuota,
  evaluateStatusTransition,
  forfeitScores,
  getGamesLockReason,
  isDeletable,
  isResultEditable,
  isResultPending,
  isOutsideLeaguePeriod,
  isScheduleEditable,
  pairKey,
} from "../lib/games.rules.ts";
import { buildGameWarnings, buildGamesLock } from "../lib/games.advisories.ts";
import {
  gameInclude,
  gameListInclude,
} from "../lib/games.queries.ts";
import { toGameItem } from "../lib/games.mapper.ts";
import type {
  GameStatus,
  GroupRoundType,
} from "../../../../prisma/generated/prisma/enums.ts";
import { jalaliToGregorianOrNull } from "../../../../utils/date.util.ts";
import { loadGame, loadGameWriteContext, loadRescheduleSource } from "../lib/games.access.ts";

interface AdminGamesQuery {
  page: number;
  pageSize: number;
  status?: GameStatus;
  groupId?: number;
  leagueTeamId?: number;
  dateFrom?: string;
  dateTo?: string;
}

interface CreateGameInput {
  homeLeagueTeamId: number;
  awayLeagueTeamId: number;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  rescheduledFromGameId?: number | null;
}

function buildWhere(leagueId: number, query: AdminGamesQuery) {
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

async function listGames(leagueId: number, query: AdminGamesQuery) {
  const league = await loadCompetitionLeague(leagueId);
  const lock = buildGamesLock(
    getGamesLockReason({ status: league.status, format: league.format }),
  );
  if (!isGroupedFormat(league.format)) {
    return {
      league: { id: league.id, format: league.format },
      lock,
      items: [],
      total: 0,
      page: query.page,
      pageSize: query.pageSize,
      summary: { byStatus: {}, resultPending: 0, unfinishedAtFinish: 0 },
    };
  }
  const where = buildWhere(leagueId, query);
  const [rows, total, pairRows] = await prisma.$transaction([
    prisma.game.findMany({
      where,
      orderBy: [{ scheduledDate: "asc" }, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: gameListInclude,
    }),
    prisma.game.count({ where }),
    prisma.game.findMany({
      where: { leagueId, status: { not: "CANCELED" } },
      select: {
        id: true,
        homeLeagueTeamId: true,
        awayLeagueTeamId: true,
        scheduledDate: true,
        status: true,
      },
    }),
  ]);
  const pairCounts = new Map<string, number>();
  for (const g of pairRows) {
    const key = pairKey(g.homeLeagueTeamId, g.awayLeagueTeamId);
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }
  const items = rows.map((row) => {
    const firstOfPair = pairRows.find(
      (g) =>
        pairKey(g.homeLeagueTeamId, g.awayLeagueTeamId) ===
        pairKey(row.homeLeagueTeamId, row.awayLeagueTeamId),
    );
    const homeAwayNotSwapped =
      league.groupRoundType === "DOUBLE_ROUND" &&
      pairCounts.get(
        pairKey(row.homeLeagueTeamId, row.awayLeagueTeamId),
      ) === 2 &&
      firstOfPair !== undefined &&
      firstOfPair.homeLeagueTeamId === row.homeLeagueTeamId;
    return {
      ...toGameItem(row),
      can: {
        editSchedule:
          isScheduleEditable(row.status) && league.status === "ACTIVE",
        enterResult:
          row.status !== "CANCELED" && !isLeagueFinished(league.status),
        cancel:
          (row.status === "SCHEDULED" ||
            row.status === "LIVE" ||
            row.status === "FINISHED") &&
          !isLeagueFinished(league.status),
        delete:
          isDeletable(row.status) && !isLeagueFinished(league.status),
      },
      issues: buildGameWarnings({
        resultPending: isResultPending(row.status, row.scheduledDate),
        unscheduled: row.scheduledDate === null,
        homeAwayNotSwapped,
        outsideLeaguePeriod: isOutsideLeaguePeriod(
          row.scheduledDate,
          league.startDate,
          league.endDate,
        ),
      }),
    };
  });
  const byStatus: Record<string, number> = {};
  let resultPending = 0;
  for (const g of pairRows) {
    byStatus[g.status] = (byStatus[g.status] ?? 0) + 1;
    if (isResultPending(g.status as GameStatus, g.scheduledDate))
      resultPending += 1;
  }
  return {
    league: { id: league.id, format: league.format },
    lock,
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    summary: {
      byStatus,
      resultPending,
      unfinishedAtFinish: resultPending,
    },
  };
}

async function getGame(leagueId: number, gameId: number) {
  const league = await loadCompetitionLeague(leagueId);
  const game = await loadGame(leagueId, gameId);
  const lock = buildGamesLock(
    getGamesLockReason({ status: league.status, format: league.format }),
  );
  return {
    ...toGameItem(game),
    can: {
      editSchedule:
        isScheduleEditable(game.status) && league.status === "ACTIVE",
      enterResult:
        game.status !== "CANCELED" && !isLeagueFinished(league.status),
      cancel:
        (game.status === "SCHEDULED" ||
          game.status === "LIVE" ||
          game.status === "FINISHED") &&
        !isLeagueFinished(league.status),
      delete:
        isDeletable(game.status) && !isLeagueFinished(league.status),
    },
    issues: buildGameWarnings({
      resultPending: isResultPending(game.status, game.scheduledDate),
      unscheduled: game.scheduledDate === null,
      homeAwayNotSwapped: false,
      outsideLeaguePeriod: isOutsideLeaguePeriod(
        game.scheduledDate,
        league.startDate,
        league.endDate,
      ),
    }),
    lock,
  };
}

async function createGame(leagueId: number, input: CreateGameInput) {
  const league = await loadCompetitionLeague(leagueId);
  if (isLeagueFinished(league.status))
    throw new AppError(409, messages.error.league.finishedLocked);
  if (league.status !== "ACTIVE")
    throw new AppError(409, messages.error.game.leagueNotActive);
  if (league.format === null)
    throw new AppError(409, messages.error.game.formatRequired);
  if (!isGroupedFormat(league.format))
    throw new AppError(409, messages.error.game.formatNotGrouped);

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

  const existingPair = await prisma.game.count({
    where: {
      leagueId,
      status: { not: "CANCELED" },
      OR: [
        {
          homeLeagueTeamId: input.homeLeagueTeamId,
          awayLeagueTeamId: input.awayLeagueTeamId,
        },
        {
          homeLeagueTeamId: input.awayLeagueTeamId,
          awayLeagueTeamId: input.homeLeagueTeamId,
        },
      ],
    },
  });
  const quota = evaluatePairQuota(
    existingPair,
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

  const scheduledDate =
    input.scheduledDate === undefined
      ? undefined
      : jalaliToGregorianOrNull(input.scheduledDate);

  const created = await prisma.game.create({
    data: {
      leagueId,
      groupId,
      homeLeagueTeamId: input.homeLeagueTeamId,
      awayLeagueTeamId: input.awayLeagueTeamId,
      scheduledDate: scheduledDate ?? null,
      scheduledTime: input.scheduledTime ?? null,
      rescheduledFromGameId: input.rescheduledFromGameId ?? null,
    },
    include: gameInclude,
  });
  const item = toGameItem(created);
  const pairGames = await prisma.game.findMany({
    where: {
      leagueId,
      id: { not: created.id },
      status: { not: "CANCELED" },
      OR: [
        {
          homeLeagueTeamId: input.homeLeagueTeamId,
          awayLeagueTeamId: input.awayLeagueTeamId,
        },
        {
          homeLeagueTeamId: input.awayLeagueTeamId,
          awayLeagueTeamId: input.homeLeagueTeamId,
        },
      ],
    },
    select: { id: true, homeLeagueTeamId: true },
    orderBy: { id: "asc" },
  });
  const homeAwayNotSwapped =
    league.groupRoundType === "DOUBLE_ROUND" &&
    pairGames.length === 1 &&
    pairGames[0].homeLeagueTeamId === input.homeLeagueTeamId;
  return {
    ...item,
    issues: buildGameWarnings({
      resultPending: false,
      unscheduled: created.scheduledDate === null,
      homeAwayNotSwapped,
      outsideLeaguePeriod: isOutsideLeaguePeriod(
        created.scheduledDate,
        league.startDate,
        league.endDate,
      ),
    }),
  };
}

async function updateSchedule(
  leagueId: number,
  gameId: number,
  input: { scheduledDate?: string | null; scheduledTime?: string | null },
) {
  const { league, game } = await loadGameWriteContext(leagueId, gameId);
  if (league.status !== "ACTIVE")
    throw new AppError(409, messages.error.game.leagueNotActive);
  if (!isScheduleEditable(game.status))
    throw new AppError(409, messages.error.game.scheduleLocked);
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
  return toGameItem(updated);
}

async function updateStatus(
  leagueId: number,
  gameId: number,
  input: { status: "LIVE" | "CANCELED"; cancelReason?: string | null },
) {
  const { league, game } = await loadGameWriteContext(leagueId, gameId);
  const check = evaluateStatusTransition(game.status, input.status);
  if (!check.allowed)
    throw new AppError(409, messages.error.game.statusLocked);
  const data: {
    status: GameStatus;
    cancelReason?: string | null;
    homeScore?: null;
    awayScore?: null;
    resultType?: null;
    forfeitLeagueTeamId?: null;
    resultNote?: null;
  } = { status: input.status };
  if (input.status === "CANCELED") {
    data.cancelReason = input.cancelReason ?? game.cancelReason;
    if (game.status === "FINISHED") {
      data.homeScore = null;
      data.awayScore = null;
      data.resultType = null;
      data.forfeitLeagueTeamId = null;
      data.resultNote = null;
    }
  }
  const updated = await prisma.game.update({
    where: { id: gameId },
    data,
    include: gameInclude,
  });
  return toGameItem(updated);
}

type ResultInput =
  | {
      resultType: "NORMAL";
      homeScore: number;
      awayScore: number;
      resultNote?: string | null;
    }
  | {
      resultType: "FORFEIT";
      forfeitLeagueTeamId: number;
      resultNote?: string | null;
    };

async function enterResult(
  leagueId: number,
  gameId: number,
  input: ResultInput,
) {
  const { game } = await loadGameWriteContext(leagueId, gameId);
  if (game.status === "CANCELED")
    throw new AppError(409, messages.error.game.statusLocked);
  if (!isResultEditable(game.status))
    throw new AppError(409, messages.error.game.statusLocked);
  if (input.resultType === "NORMAL") {
    const check = evaluateNormalResult(input.homeScore, input.awayScore);
    if (!check.allowed)
      throw new AppError(
        400,
        check.reason === "TIE_NOT_ALLOWED"
          ? messages.error.game.tieNotAllowed
          : messages.error.game.scoreInvalid,
      );
    const updated = await prisma.game.update({
      where: { id: gameId },
      data: {
        status: "FINISHED",
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        resultType: "NORMAL",
        forfeitLeagueTeamId: null,
        resultNote: input.resultNote ?? null,
        cancelReason: null,
      },
      include: gameInclude,
    });
    return toGameItem(updated);
  }
  if (
    input.forfeitLeagueTeamId !== game.homeLeagueTeamId &&
    input.forfeitLeagueTeamId !== game.awayLeagueTeamId
  )
    throw new AppError(400, messages.error.game.scoreInvalid);
  const scores = forfeitScores(
    input.forfeitLeagueTeamId === game.homeLeagueTeamId,
  );
  const updated = await prisma.game.update({
    where: { id: gameId },
    data: {
      status: "FINISHED",
      homeScore: scores.homeScore,
      awayScore: scores.awayScore,
      resultType: "FORFEIT",
      forfeitLeagueTeamId: input.forfeitLeagueTeamId,
      resultNote: input.resultNote ?? null,
      cancelReason: null,
    },
    include: gameInclude,
  });
  return toGameItem(updated);
}

async function deleteGame(leagueId: number, gameId: number) {
  const { game } = await loadGameWriteContext(leagueId, gameId);
  if (!isDeletable(game.status))
    throw new AppError(409, messages.error.game.deleteNotAllowed);
  if (game.rescheduledTo !== null)
    throw new AppError(409, messages.error.game.hasReplacement);
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
  deleteGame,
};
