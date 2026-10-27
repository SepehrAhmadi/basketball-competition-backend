import type { LeagueStatus } from "../../../prisma/generated/prisma/enums.ts";

export const TEAM_DELETE_BLOCKING_LEAGUE_STATUSES = [
  "REGISTRATION",
  "ACTIVE",
] as const satisfies readonly LeagueStatus[];

export type TeamDeleteDenial = "IN_OPEN_LEAGUE";

export function evaluateTeamDelete(
  leagueStatuses: LeagueStatus[],
): { allowed: true } | { allowed: false; reason: TeamDeleteDenial } {
  const blocked = leagueStatuses.some(
    (s) =>
      (TEAM_DELETE_BLOCKING_LEAGUE_STATUSES as readonly string[]).includes(s),
  );
  return blocked ? { allowed: false, reason: "IN_OPEN_LEAGUE" } : { allowed: true };
}
