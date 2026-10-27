export const LEAGUE_FORMAT_VALUES = [
  "GROUPS_KNOCKOUT",
  "SINGLE_GROUP_KNOCKOUT",
  "KNOCKOUT_ONLY",
] as const;

export type LeagueFormatValue = (typeof LEAGUE_FORMAT_VALUES)[number];

export const GROUP_ROUND_TYPE_VALUES = [
  "ONE_ROUND",
  "DOUBLE_ROUND",
] as const;

export type GroupRoundTypeValue = (typeof GROUP_ROUND_TYPE_VALUES)[number];

export function isGroupStageFormat(format: LeagueFormatValue): boolean {
  return format === "GROUPS_KNOCKOUT" || format === "SINGLE_GROUP_KNOCKOUT";
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
