import type { LeagueStatus } from "../../../prisma/generated/prisma/enums.ts";

export const TEAM_DELETE_BLOCKING_LEAGUE_STATUSES = [
  "REGISTRATION",
  "ACTIVE",
] as const satisfies readonly LeagueStatus[];

export type TeamDeleteDenial = "IN_OPEN_LEAGUE";

export function getTeamLockReason(locked: boolean): TeamDeleteDenial | null {
  return locked ? "IN_OPEN_LEAGUE" : null;
}
