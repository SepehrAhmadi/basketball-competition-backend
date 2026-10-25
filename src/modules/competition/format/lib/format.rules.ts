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

export const DEFAULT_WIN_POINTS = 2;
export const DEFAULT_LOSS_POINTS = 1;

export function isGroupStageFormat(format: LeagueFormatValue): boolean {
  return format === "GROUPS_KNOCKOUT" || format === "SINGLE_GROUP_KNOCKOUT";
}

export interface FormatInput {
  format: LeagueFormatValue;
  winPoints?: number;
  lossPoints?: number;
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
  const winPoints = input.winPoints ?? DEFAULT_WIN_POINTS;
  const lossPoints = input.lossPoints ?? DEFAULT_LOSS_POINTS;

  if (!isGroupStageFormat(input.format)) {
    return {
      format: input.format,
      winPoints,
      lossPoints,
      groupRoundType: null,
      defaultQualifiersPerGroup: null,
    };
  }

  return {
    format: input.format,
    winPoints,
    lossPoints,
    groupRoundType: input.groupRoundType ?? null,
    defaultQualifiersPerGroup: input.defaultQualifiersPerGroup ?? null,
  };
}

export type FormatLockReason = "FINISHED" | "HAS_GAMES" | null;
