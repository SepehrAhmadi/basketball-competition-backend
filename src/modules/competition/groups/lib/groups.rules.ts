import type { LeagueFormat, LeagueStatus } from "../../../../prisma/generated/prisma/enums.ts";
import { isGroupedFormat } from "../../format/lib/format.rules.ts";
import { isLeagueFinished } from "../../../leagues/lib/league.rules.ts";

export const MIN_TEAMS_PER_GROUP = 2;
export const MAX_GROUPS_SINGLE_GROUP_FORMAT = 1;

export type GroupsLockReason = "FINISHED" | null;

export function getGroupsLockReason(status: LeagueStatus): GroupsLockReason {
  return isLeagueFinished(status) ? "FINISHED" : null;
}

export type CreateGroupDenial = "FORMAT_NOT_GROUPED" | "SINGLE_GROUP_ONLY";

export function evaluateCreateGroup(
  format: LeagueFormat | null,
  existingGroupCount: number,
): { allowed: true } | { allowed: false; reason: CreateGroupDenial } {
  if (!isGroupedFormat(format))
    return { allowed: false, reason: "FORMAT_NOT_GROUPED" };
  if (
    format === "SINGLE_GROUP_KNOCKOUT" &&
    existingGroupCount >= MAX_GROUPS_SINGLE_GROUP_FORMAT
  )
    return { allowed: false, reason: "SINGLE_GROUP_ONLY" };
  return { allowed: true };
}

export function effectiveQualifiers(
  override: number | null,
  leagueDefault: number | null,
): number | null {
  return override ?? leagueDefault ?? null;
}

export type GroupIssueCode = "GROUP_TOO_SMALL" | "QUALIFIERS_EXCEED_TEAMS";

export function evaluateGroupIssues(input: {
  teamsCount: number;
  qualifiers: number | null;
}): GroupIssueCode[] {
  if (input.teamsCount < MIN_TEAMS_PER_GROUP) return ["GROUP_TOO_SMALL"];
  if (
    input.qualifiers !== null &&
    input.qualifiers >= input.teamsCount
  )
    return ["QUALIFIERS_EXCEED_TEAMS"];
  return [];
}
