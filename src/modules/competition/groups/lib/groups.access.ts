import prisma from "../../../../config/db.config.ts";
import AppError from "../../../../utils/appError.ts";
import { messages } from "../../../../language/message.ts";
import type { Actor } from "../../../../authz/actor.ts";
import type {
  LeagueFormat,
  LeagueStatus,
} from "../../../../prisma/generated/prisma/enums.ts";
import { activeLeagueTeamWhere } from "../../../leagues/lib/league.mapper.ts";
import { getGroupsLockReason } from "./groups.rules.ts";

export interface GroupsLeague {
  id: number;
  status: LeagueStatus;
  format: LeagueFormat | null;
  defaultQualifiersPerGroup: number | null;
}

export async function loadGroupsLeague(
  leagueId: number,
  options?: { hideInactiveFrom?: Actor },
): Promise<GroupsLeague> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      id: true,
      status: true,
      format: true,
      defaultQualifiersPerGroup: true,
    },
  });
  if (!league) throw new AppError(404, messages.error.league.notFound);
  if (
    options?.hideInactiveFrom &&
    league.status === "INACTIVE" &&
    !options.hideInactiveFrom.isAdmin
  )
    throw new AppError(404, messages.error.league.notFound);
  return league;
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

export async function loadActiveLeagueTeam(
  leagueId: number,
  leagueTeamId: number,
) {
  const leagueTeam = await prisma.leagueTeam.findFirst({
    where: { id: leagueTeamId, ...activeLeagueTeamWhere(leagueId) },
  });
  if (!leagueTeam)
    throw new AppError(404, messages.error.leagueTeam.notFound);
  return leagueTeam;
}

function unwrap<T>(result: PromiseSettledResult<T>): T {
  if (result.status === "rejected") throw result.reason;
  return result.value;
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
