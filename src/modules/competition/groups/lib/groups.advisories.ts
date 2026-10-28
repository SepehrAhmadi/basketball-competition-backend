import { makeAdvisory, type Advisory } from "../../../../shared/advisory.ts";
import { messages } from "../../../../language/message.ts";
import type { GroupIssueCode, GroupsLockReason } from "./groups.rules.ts";
import { evaluateGroupIssues, MIN_TEAMS_PER_GROUP } from "./groups.rules.ts";

export type GroupsLockCode = Exclude<GroupsLockReason, null>;
export type GroupIssueAdvisory = Advisory<GroupIssueCode>;
export type UnassignedIssueAdvisory = Advisory<"TEAM_UNASSIGNED">;

interface GroupIssueInput {
  id: number;
  name: string;
  teamsCount: number;
  qualifiers: number | null;
}

const GROUP_ISSUE_BUILDERS: Record<
  GroupIssueCode,
  (input: GroupIssueInput) => GroupIssueAdvisory
> = {
  GROUP_TOO_SMALL: (input) =>
    makeAdvisory(
      "GROUP_TOO_SMALL",
      "WARNING",
      messages.advisory.groups.groupTooSmall(input.name, MIN_TEAMS_PER_GROUP),
      {
        groupId: input.id,
        name: input.name,
        min: MIN_TEAMS_PER_GROUP,
        current: input.teamsCount,
      },
    ),
  QUALIFIERS_EXCEED_TEAMS: (input) =>
    makeAdvisory(
      "QUALIFIERS_EXCEED_TEAMS",
      "WARNING",
      messages.advisory.groups.qualifiersExceedTeams(
        input.name,
        input.qualifiers as number,
        input.teamsCount,
      ),
      {
        groupId: input.id,
        name: input.name,
        qualifiers: input.qualifiers,
        current: input.teamsCount,
      },
    ),
};

export function buildGroupIssues(input: GroupIssueInput): GroupIssueAdvisory[] {
  return evaluateGroupIssues({
    teamsCount: input.teamsCount,
    qualifiers: input.qualifiers,
  }).map((code) => GROUP_ISSUE_BUILDERS[code](input));
}

export function buildUnassignedIssue(count: number): UnassignedIssueAdvisory[] {
  if (count === 0) return [];
  return [
    makeAdvisory(
      "TEAM_UNASSIGNED",
      "WARNING",
      messages.advisory.groups.teamUnassigned(count),
      { count },
    ),
  ];
}

const GROUPS_LOCK_MESSAGES: Record<GroupsLockCode, string> = {
  FINISHED: messages.advisory.leagueFinished,
};

export function buildGroupsLock(
  reason: GroupsLockReason,
): Advisory<GroupsLockCode> | null {
  if (reason === null) return null;
  return makeAdvisory(reason, "BLOCKER", GROUPS_LOCK_MESSAGES[reason], {});
}
