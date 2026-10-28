import type { LeagueStatus } from "../../../../prisma/generated/prisma/enums.ts";
import { LEAGUE_STATUS_VALUES } from "../../../leagues/lib/league.rules.ts";

/**
 * Statuses the admin league dropdown may return.
 * Admins see every status, so the requested status only narrows the result.
 */
export function resolveLeagueStatuses(
  requested?: LeagueStatus,
): readonly LeagueStatus[] {
  if (!requested) return LEAGUE_STATUS_VALUES;
  return LEAGUE_STATUS_VALUES.includes(requested) ? [requested] : [];
}

/** Label format: "<league name> — <season name> — <age category name>". */
export function buildLeagueLabel(input: {
  name: string;
  seasonName: string;
  ageCategoryName: string;
}): string {
  return `${input.name} — ${input.seasonName} — ${input.ageCategoryName}`;
}
