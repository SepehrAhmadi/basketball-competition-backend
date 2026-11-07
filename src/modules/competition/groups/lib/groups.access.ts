import prisma from "../../../../config/db.config.ts";
import AppError from "../../../../utils/appError.ts";
import { messages } from "../../../../language/message.ts";
import type { Actor } from "../../../../authz/actor.ts";
import type { CompetitionLeague } from "../../lib/competition.access.ts";
import {
  loadActiveLeagueTeam,
  loadCompetitionLeague,
  unwrap,
} from "../../lib/competition.access.ts";
import { getGroupsLockReason } from "./groups.rules.ts";

export { loadActiveLeagueTeam };

export type GroupsLeague = CompetitionLeague;

export function loadGroupsLeague(
  leagueId: number,
  options?: { hideInactiveFrom?: Actor },
): Promise<GroupsLeague> {
  return loadCompetitionLeague(leagueId, options);
}

export function assertGroupsEditable(league: GroupsLeague): void {
  if (getGroupsLockReason(league.status) !== null)
    throw new AppError(409, messages.error.league.finishedLocked);
}

export async function loadGroup(leagueId: number, groupId: number) {
  const group = await prisma.group.findFirst({
    where: { id: groupId, leagueId },
  });
  if (!group) throw new AppError(404, messages.error.group.notFound);
  return group;
}

// The loaders run together, but errors surface in the documented order:
// league 404 → FINISHED 409 → group 404 → league team 404.
export async function loadAssignmentContext(
  leagueId: number,
  groupId: number,
  leagueTeamId: number,
) {
  const [league, group, leagueTeam] = await Promise.allSettled([
    loadGroupsLeague(leagueId),
    loadGroup(leagueId, groupId),
    loadActiveLeagueTeam(leagueId, leagueTeamId),
  ]);
  const loadedLeague = unwrap(league);
  assertGroupsEditable(loadedLeague);
  return {
    league: loadedLeague,
    group: unwrap(group),
    leagueTeam: unwrap(leagueTeam),
  };
}

export async function loadRemovalContext(leagueId: number, groupId: number) {
  const [league, group] = await Promise.allSettled([
    loadGroupsLeague(leagueId),
    loadGroup(leagueId, groupId),
  ]);
  const loadedLeague = unwrap(league);
  assertGroupsEditable(loadedLeague);
  return { league: loadedLeague, group: unwrap(group) };
}
