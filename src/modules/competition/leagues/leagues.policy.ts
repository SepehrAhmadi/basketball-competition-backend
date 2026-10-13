import type { Actor } from "../../../authz/actor.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";
import {
  canEditByStatus,
  isRosterWindowOpen,
} from "../shared/league.rules.ts";
import type { LeagueTeamAccess } from "../shared/league.types.ts";
import type { LeagueStatus } from "../../../prisma/generated/prisma/enums.ts";

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
  status: LeagueStatus;
  rosterDeadline: Date | null;
}

export type Denial = "NOT_AUTHORIZED" | "STATUS_CLOSED" | "WINDOW_CLOSED";

export type Evaluation =
  | { allowed: true }
  | { allowed: false; reason: Denial };

/** Maps a policy denial to the matching HTTP error. */
export function throwDenial(reason: Denial): never {
  switch (reason) {
    case "NOT_AUTHORIZED":
      throw new AppError(403, messages.error.league.notAuthorized);
    case "STATUS_CLOSED":
      throw new AppError(409, messages.error.league.registrationClosed);
    case "WINDOW_CLOSED":
      throw new AppError(409, messages.error.league.rosterClosed);
  }
}

/**
 * Single source for "may this actor register a team in this league?".
 * Check order is identity (403) → status (409) → window (409).
 */
export function evaluateRegister(
  actor: Actor,
  league: LeagueState,
  organizationId: number,
  now?: Date,
): Evaluation {
  if (!actor.isAdmin && !actor.managedOrgIds.has(organizationId))
    return { allowed: false, reason: "NOT_AUTHORIZED" };
  if (!canEditByStatus(league.status, actor.isAdmin))
    return { allowed: false, reason: "STATUS_CLOSED" };
  if (!actor.isAdmin && !isRosterWindowOpen(league.rosterDeadline, now))
    return { allowed: false, reason: "WINDOW_CLOSED" };
  return { allowed: true };
}

/**
 * Single source for "may this roster role edit this league's roster?".
 * Check order is identity (403) → status (409) → window (409).
 */
export function evaluateRosterEdit(
  access: LeagueTeamAccess,
  league: LeagueState,
  now?: Date,
): Evaluation {
  if (access.rosterRole === null || access.rosterRole === "MEMBER")
    return { allowed: false, reason: "NOT_AUTHORIZED" };
  const isAdmin = access.rosterRole === "ADMIN";
  if (!canEditByStatus(league.status, isAdmin))
    return { allowed: false, reason: "STATUS_CLOSED" };
  if (!isAdmin && !isRosterWindowOpen(league.rosterDeadline, now))
    return { allowed: false, reason: "WINDOW_CLOSED" };
  return { allowed: true };
}

export function leaguePolicy(
  actor: Actor,
  league: LeagueState,
  now?: Date,
): LeagueCan {
  const view = league.status !== "INACTIVE" || actor.isAdmin;
  // Generic list flag (no org context): any managed org gives the same
  // status/window answer, so evaluating with the first one is equivalent.
  let registerTeam = false;
  if (actor.isAdmin) {
    registerTeam = evaluateRegister(actor, league, 0, now).allowed;
  } else if (actor.userId !== null && actor.managedOrgIds.size > 0) {
    const [firstOrg] = actor.managedOrgIds;
    registerTeam = evaluateRegister(actor, league, firstOrg, now).allowed;
  }
  return { view, registerTeam };
}

export function leagueTeamPolicy(
  league: LeagueState,
  access: LeagueTeamAccess,
  now?: Date,
): LeagueTeamCan {
  const allowed = evaluateRosterEdit(access, league, now).allowed;
  switch (access.rosterRole) {
    case "ADMIN":
      return {
        manageRoster: allowed,
        unregister: allowed && league.status !== "ACTIVE",
      };
    case "MANAGER":
      return { manageRoster: allowed, unregister: allowed };
    case "HEAD_COACH":
      return { manageRoster: allowed, unregister: false };
    case "MEMBER":
      // View-only: may see the roster but never edit it.
      return { manageRoster: false, unregister: false };
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


