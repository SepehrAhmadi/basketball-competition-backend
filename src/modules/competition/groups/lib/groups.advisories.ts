import { makeAdvisory, type Advisory } from "../../../../shared/advisory.ts";
import { messages } from "../../../../language/message.ts";
import type { GroupIssueCode, GroupsLockReason } from "./groups.rules.ts";
import { MIN_TEAMS_PER_GROUP } from "./groups.rules.ts";

export type GroupsLockCode = Exclude<GroupsLockReason, null>;
export type GroupIssueAdvisory = Advisory<GroupIssueCode>;
export type UnassignedIssueAdvisory = Advisory<"TEAM_UNASSIGNED">;

export function buildGroupIssues(input: {
  id: number;
  name: string;
  teamsCount: number;
  qualifiers: number | null;
}): GroupIssueAdvisory[] {
  if (input.teamsCount < MIN_TEAMS_PER_GROUP)
    return [
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
    ];
  if (input.qualifiers !== null && input.qualifiers >= input.teamsCount)
    return [
      makeAdvisory(
        "QUALIFIERS_EXCEED_TEAMS",
        "WARNING",
        messages.advisory.groups.qualifiersExceedTeams(
          input.name,
          input.qualifiers,
          input.teamsCount,
        ),
        {
          groupId: input.id,
          name: input.name,
          qualifiers: input.qualifiers,
          current: input.teamsCount,
        },
      ),
    ];
  return [];
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

export function buildGroupsLock(
  reason: GroupsLockReason,
): Advisory<GroupsLockCode> | null {
  if (reason === null) return null;
  return makeAdvisory(
    reason,
    "BLOCKER",
    messages.advisory.groups.finished,
    {},
  );
}
