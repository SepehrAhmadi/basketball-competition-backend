import type { Actor } from "../../../authz/actor.ts";
import {
  canEditByStatus,
  isRosterWindowOpen,
} from "../shared/league.rules.ts";
import type { LeagueTeamAccess } from "../shared/league.access.ts";

export interface LeagueCan {
  view: boolean;
  registerTeam: boolean;
}

export interface LeagueTeamCan {
  manageRoster: boolean;
  unregister: boolean;
}

export type LockReason = "OWN_ROW" | "MANAGER_ONLY" | null;

export interface RosterRowDecision {
  canToggle: boolean;
  lockReason: LockReason;
}

export interface LeagueState {
  status: "INACTIVE" | "REGISTRATION" | "ACTIVE" | "FINISHED";
  rosterDeadline: Date | null;
}

export function leaguePolicy(actor: Actor, league: LeagueState): LeagueCan {
  const view = league.status !== "INACTIVE" || actor.isAdmin;
  let registerTeam = false;
  if (actor.isAdmin) {
    registerTeam = canEditByStatus(league.status, true);
  } else if (actor.userId !== null && actor.managedOrgIds.size > 0) {
    registerTeam =
      league.status === "REGISTRATION" &&
      isRosterWindowOpen(league.rosterDeadline);
  }
  return { view, registerTeam };
}

/** Status/window rule for roster edits by a non-admin (manager / head coach). */
function nonAdminCanEdit(league: LeagueState, now?: Date): boolean {
  return (
    league.status === "REGISTRATION" &&
    isRosterWindowOpen(league.rosterDeadline, now)
  );
}

export function leagueTeamPolicy(
  league: LeagueState,
  access: LeagueTeamAccess,
  now?: Date,
): LeagueTeamCan {
  switch (access.rosterRole) {
    case "ADMIN": {
      const allowed = canEditByStatus(league.status, true);
      return {
        manageRoster: allowed,
        unregister: allowed && league.status !== "ACTIVE",
      };
    }
    case "MANAGER": {
      const allowed = nonAdminCanEdit(league, now);
      return { manageRoster: allowed, unregister: allowed };
    }
    case "HEAD_COACH":
      return { manageRoster: nonAdminCanEdit(league, now), unregister: false };
    default:
      return { manageRoster: false, unregister: false };
  }
}

export function rosterRowPolicy(
  access: LeagueTeamAccess,
  league: LeagueState,
  target: { teamSeasonMemberId: number; isHeadCoach: boolean },
  now?: Date,
): RosterRowDecision {
  if (!leagueTeamPolicy(league, access, now).manageRoster)
    return { canToggle: false, lockReason: null };

  if (access.rosterRole === "HEAD_COACH") {
    if (
      access.ownTeamSeasonMemberId !== null &&
      access.ownTeamSeasonMemberId === target.teamSeasonMemberId
    )
      return { canToggle: false, lockReason: "OWN_ROW" };
    if (target.isHeadCoach)
      return { canToggle: false, lockReason: "MANAGER_ONLY" };
  }
  return { canToggle: true, lockReason: null };
}

export default {
  leaguePolicy,
  leagueTeamPolicy,
  rosterRowPolicy,
};
