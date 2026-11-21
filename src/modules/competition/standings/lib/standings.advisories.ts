import { makeAdvisory, type Advisory } from "../../../../shared/advisory.ts";
import { messages } from "../../../../language/message.ts";
import type { TiedRun } from "./standings.rules.ts";

export type StandingsIssueCode = "UNRESOLVED_TIE";
export type StandingsIssueAdvisory = Advisory<StandingsIssueCode>;

function format(
  template: string,
  params: Record<string, string | number>,
): string {
  return Object.entries(params).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function buildUnresolvedTieIssues(
  group: { id: number; name: string },
  ties: TiedRun[],
): StandingsIssueAdvisory[] {
  return ties.map((tie) =>
    makeAdvisory(
      "UNRESOLVED_TIE",
      "WARNING",
      format(messages.advisory.standings.unresolvedTie, { name: group.name }),
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
