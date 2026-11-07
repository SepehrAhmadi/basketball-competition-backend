import {
  GameResultType,
  GameStatus,
  GroupRoundType,
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

export const GAME_RESULT_TYPE_VALUES = Object.values(GameResultType) as [
  GameResultType,
  ...GameResultType[],
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

export type StatusTransitionDenial = "STATUS_LOCKED";

export function evaluateStatusTransition(
  from: GameStatusValue,
  to: GameStatusValue,
): { allowed: true } | { allowed: false; reason: StatusTransitionDenial } {
  if (from === "SCHEDULED" && (to === "LIVE" || to === "CANCELED"))
    return { allowed: true };
  if (from === "LIVE" && to === "CANCELED") return { allowed: true };
  if (from === "FINISHED" && to === "CANCELED") return { allowed: true };
  return { allowed: false, reason: "STATUS_LOCKED" };
}

export function isScheduleEditable(status: GameStatusValue): boolean {
  return status === "SCHEDULED" || status === "LIVE";
}

export function isResultEditable(status: GameStatusValue): boolean {
  return status === "SCHEDULED" || status === "LIVE" || status === "FINISHED";
}

export function isDeletable(status: GameStatusValue): boolean {
  return status === "SCHEDULED" || status === "CANCELED";
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
