// Pure rules: only the generated enum constants are imported (no Prisma client).
import {
  GroupRoundType,
  LeagueFormat,
  type LeagueStatus,
} from "../../../../prisma/generated/prisma/enums.ts";
import { isLeagueFinished } from "../../../leagues/lib/league.rules.ts";

export const LEAGUE_FORMAT_VALUES = Object.values(LeagueFormat) as [
  LeagueFormat,
  ...LeagueFormat[],
];

export type LeagueFormatValue = LeagueFormat;

export const GROUP_ROUND_TYPE_VALUES = Object.values(GroupRoundType) as [
  GroupRoundType,
  ...GroupRoundType[],
];

export type GroupRoundTypeValue = GroupRoundType;

export function isGroupStageFormat(format: LeagueFormatValue): boolean {
  return format === "GROUPS_KNOCKOUT" || format === "SINGLE_GROUP_KNOCKOUT";
}

/** A league whose format has not been chosen yet is not grouped. */
export function isGroupedFormat(format: LeagueFormatValue | null): boolean {
  return format !== null && isGroupStageFormat(format);
}

export interface FormatInput {
  format: LeagueFormatValue;
  winPoints: number;
  lossPoints: number;
  groupRoundType?: GroupRoundTypeValue;
  defaultQualifiersPerGroup?: number;
}

export interface FormatData {
  format: LeagueFormatValue;
  winPoints: number;
  lossPoints: number;
  groupRoundType: GroupRoundTypeValue | null;
  defaultQualifiersPerGroup: number | null;
}

export function normalizeFormatInput(input: FormatInput): FormatData {
  if (!isGroupStageFormat(input.format)) {
    return {
      format: input.format,
      winPoints: input.winPoints,
      lossPoints: input.lossPoints,
      groupRoundType: null,
      defaultQualifiersPerGroup: null,
    };
  }

  return {
    format: input.format,
    winPoints: input.winPoints,
    lossPoints: input.lossPoints,
    groupRoundType: input.groupRoundType ?? null,
    defaultQualifiersPerGroup: input.defaultQualifiersPerGroup ?? null,
  };
}

export type FormatLockReason = "FINISHED" | "HAS_GAMES" | null;

export function getFormatLockReason(status: LeagueStatus): FormatLockReason {
  return isLeagueFinished(status) ? "FINISHED" : null;
}

export type FormatChangeDenial = "HAS_GROUPS" | "TOO_MANY_GROUPS";

export function evaluateFormatChange(
  nextFormat: LeagueFormatValue,
  groupCount: number,
): { allowed: true } | { allowed: false; reason: FormatChangeDenial } {
  if (nextFormat === "KNOCKOUT_ONLY" && groupCount > 0)
    return { allowed: false, reason: "HAS_GROUPS" };
  if (nextFormat === "SINGLE_GROUP_KNOCKOUT" && groupCount > 1)
    return { allowed: false, reason: "TOO_MANY_GROUPS" };
  return { allowed: true };
}
