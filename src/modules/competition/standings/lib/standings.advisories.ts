import {
  formatMessage,
  makeAdvisory,
  type Advisory,
} from "../../../../shared/advisory.ts";
import { messages } from "../../../../language/message.ts";
import type { TiedRun } from "./standings.rules.ts";

export type StandingsIssueCode = "UNRESOLVED_TIE";
export type StandingsIssueAdvisory = Advisory<StandingsIssueCode>;

export function buildUnresolvedTieIssues(
  group: { id: number; name: string },
  ties: TiedRun[],
): StandingsIssueAdvisory[] {
  return ties.map((tie) =>
    makeAdvisory(
      "UNRESOLVED_TIE",
      "WARNING",
      formatMessage(messages.advisory.standings.unresolvedTie, { name: group.name }),
      {
        groupId: group.id,
        name: group.name,
        fromRank: tie.fromRank,
        toRank: tie.toRank,
        count: tie.leagueTeamIds.length,
      },
    ),
  );
}
