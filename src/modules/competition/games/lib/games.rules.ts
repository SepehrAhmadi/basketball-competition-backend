import {
  GameStatus,
  GroupRoundType,
  type GameResultType,
  type GameStatus as GameStatusValue,
  type LeagueFormat,
  type LeagueStatus,
} from "../../../../prisma/generated/prisma/enums.ts";
import { isGroupedFormat } from "../../format/lib/format.rules.ts";
import { todayInTehran } from "../../../../utils/date.util.ts";

export const GAME_STATUS_VALUES = Object.values(GameStatus) as [
  GameStatusValue,
  ...GameStatusValue[],
];


export const MAX_PAIR_GAMES: Record<GroupRoundType, number> = {
  ONE_ROUND: 1,
  DOUBLE_ROUND: 2,
};

export function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export type GamesLockReason =
  | "FINISHED"
  | "LEAGUE_NOT_ACTIVE"
  | "FORMAT_NOT_SET"
  | "FORMAT_NOT_GROUPED"
  | null;

export function getGamesLockReason(input: {
  status: LeagueStatus;
  format: LeagueFormat | null;
}): GamesLockReason {
  if (input.status === "FINISHED") return "FINISHED";
  if (input.status !== "ACTIVE") return "LEAGUE_NOT_ACTIVE";
  if (input.format === null) return "FORMAT_NOT_SET";
  if (!isGroupedFormat(input.format)) return "FORMAT_NOT_GROUPED";
  return null;
}

export type PairQuotaDenial = "PAIR_LIMIT_REACHED";

export function evaluatePairQuota(
  existingNonCanceled: number,
  roundType: GroupRoundType,
): { allowed: true } | { allowed: false; reason: PairQuotaDenial } {
  if (existingNonCanceled >= MAX_PAIR_GAMES[roundType])
    return { allowed: false, reason: "PAIR_LIMIT_REACHED" };
  return { allowed: true };
}

export type GameActionDenial =
  | "FINISHED"
  | "LEAGUE_NOT_ACTIVE"
  | "STATUS_LOCKED"
  | "HAS_REPLACEMENT"
  | "DEPENDENT_STARTED"; // reserved for Stage 5, never emitted now

export type GameAction = "schedule" | "start" | "cancel" | "result" | "delete";

export type GameActions = Record<GameAction, GameActionDenial | null>;

/** Single source of truth for every game action (admin locks and service errors). */
export function evaluateGameActions(input: {
  status: GameStatusValue;
  leagueStatus: LeagueStatus;
  hasReplacement: boolean;
}): GameActions {
  const { status, leagueStatus, hasReplacement } = input;
  const leagueDenial: GameActionDenial | null =
    leagueStatus === "FINISHED"
      ? "FINISHED"
      : leagueStatus !== "ACTIVE"
        ? "LEAGUE_NOT_ACTIVE"
        : null;
  const gate = (
    gameAllowed: boolean,
    extra: GameActionDenial | null = null,
  ): GameActionDenial | null => {
    if (leagueDenial) return leagueDenial;
    if (!gameAllowed) return "STATUS_LOCKED";
    return extra;
  };
  const open = status === "SCHEDULED" || status === "LIVE";
  return {
    schedule: gate(open),
    start: gate(status === "SCHEDULED"),
    cancel: gate(open),
    result: gate(status !== "CANCELED"),
    delete: gate(
      status === "SCHEDULED" || status === "CANCELED",
      hasReplacement ? "HAS_REPLACEMENT" : null,
    ),
  };
}

export type ScoreDenial = "SCORE_INVALID" | "TIE_NOT_ALLOWED";

export function evaluateNormalResult(
  homeScore: number,
  awayScore: number,
): { allowed: true } | { allowed: false; reason: ScoreDenial } {
  if (
    !Number.isInteger(homeScore) ||
    !Number.isInteger(awayScore) ||
    homeScore < 0 ||
    awayScore < 0
  )
    return { allowed: false, reason: "SCORE_INVALID" };
  if (homeScore === awayScore)
    return { allowed: false, reason: "TIE_NOT_ALLOWED" };
  return { allowed: true };
}

export type ResultInput =
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

export type ResultDenial =
  | "SCORE_INVALID"
  | "TIE_NOT_ALLOWED"
  | "FORFEIT_TEAM_INVALID";

export function buildResultData(
  input: ResultInput,
  teams: { homeLeagueTeamId: number; awayLeagueTeamId: number },
):
  | {
      ok: true;
      data: {
        homeScore: number;
        awayScore: number;
        resultType: GameResultType;
        forfeitLeagueTeamId: number | null;
      };
    }
  | { ok: false; reason: ResultDenial } {
  if (input.resultType === "NORMAL") {
    const check = evaluateNormalResult(input.homeScore, input.awayScore);
    if (!check.allowed) return { ok: false, reason: check.reason };
    return {
      ok: true,
      data: {
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        resultType: "NORMAL",
        forfeitLeagueTeamId: null,
      },
    };
  }
  if (
    input.forfeitLeagueTeamId !== teams.homeLeagueTeamId &&
    input.forfeitLeagueTeamId !== teams.awayLeagueTeamId
  )
    return { ok: false, reason: "FORFEIT_TEAM_INVALID" };
  return {
    ok: true,
    data: {
      ...forfeitScores(input.forfeitLeagueTeamId === teams.homeLeagueTeamId),
      resultType: "FORFEIT",
      forfeitLeagueTeamId: input.forfeitLeagueTeamId,
    },
  };
}

export interface PairGame {
  id: number;
  homeLeagueTeamId: number;
  awayLeagueTeamId: number;
}

/**
 * DOUBLE_ROUND only: for a pair with exactly two non-canceled games, the
 * second game (larger id) is flagged when it has the same home team as the first.
 */
export function notSwappedGameIds(
  nonCanceledGames: PairGame[],
  roundType: GroupRoundType | null,
): Set<number> {
  const flagged = new Set<number>();
  if (roundType !== "DOUBLE_ROUND") return flagged;
  const byPair = new Map<string, PairGame[]>();
  for (const game of nonCanceledGames) {
    const key = pairKey(game.homeLeagueTeamId, game.awayLeagueTeamId);
    const list = byPair.get(key);
    if (list) list.push(game);
    else byPair.set(key, [game]);
  }
  for (const games of byPair.values()) {
    if (games.length !== 2) continue;
    const [first, second] = [...games].sort((a, b) => a.id - b.id);
    if (second.homeLeagueTeamId === first.homeLeagueTeamId)
      flagged.add(second.id);
  }
  return flagged;
}

export function forfeitScores(forfeitIsHome: boolean): {
  homeScore: number;
  awayScore: number;
} {
  return forfeitIsHome
    ? { homeScore: 0, awayScore: 20 }
    : { homeScore: 20, awayScore: 0 };
}

export function isResultPending(
  status: GameStatusValue,
  scheduledDate: Date | null,
  now: Date = new Date(),
): boolean {
  if (status !== "SCHEDULED" && status !== "LIVE") return false;
  if (!scheduledDate) return false;
  const scheduledDay = scheduledDate.toISOString().slice(0, 10);
  return scheduledDay < todayInTehran(now);
}

export function isOutsideLeaguePeriod(
  scheduledDate: Date | null,
  startDate: Date | null,
  endDate: Date | null,
): boolean {
  if (!scheduledDate) return false;
  const day = scheduledDate.getTime();
  if (startDate && day < startDate.getTime()) return true;
  if (endDate && day > endDate.getTime()) return true;
  return false;
}
