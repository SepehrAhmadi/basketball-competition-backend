import type { Actor } from "../../../authz/actor.ts";
import {
  canEditByStatus,
  isRosterWindowOpen,
} from "../shared/league.rules.ts";

export interface LeagueCan {
  view: boolean;
  registerTeam: boolean;
}

export interface LeagueTeamCan {
  manageRoster: boolean;
  unregister: boolean;
}

interface LeagueState {
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

export function leagueTeamPolicy(
  actor: Actor,
  league: LeagueState,
  organizationId: number,
): LeagueTeamCan {
  if (actor.isAdmin) {
    const allowed = canEditByStatus(league.status, true);
    return { manageRoster: allowed, unregister: allowed };
  }
  if (actor.userId === null || !actor.managedOrgIds.has(organizationId)) {
    return { manageRoster: false, unregister: false };
  }
  const allowed =
    canEditByStatus(league.status, false) &&
    isRosterWindowOpen(league.rosterDeadline);
  return { manageRoster: allowed, unregister: allowed };
}

export default {
  leaguePolicy,
  leagueTeamPolicy,
};
