import type { Actor } from "../../authz/actor.ts";

export interface TeamCan {
  view: boolean;
  edit: boolean;
  delete: boolean;
}

export interface RosterCan {
  assignHeadCoach: boolean;
  manageCoaches: boolean;
  managePlayers: boolean;
}

export interface RosterMemberCan {
  edit: boolean;
  delete: boolean;
}

export function teamPolicy(
  actor: Actor,
  params: { organizationId: number; teamId: number },
): TeamCan {
  const manager = actor.isAdmin || actor.managedOrgIds.has(params.organizationId);
  const member = actor.memberTeamIds.has(params.teamId);
  return { view: manager || member, edit: manager, delete: manager };
}

export function rosterPolicy(
  actor: Actor,
  params: { organizationId: number; teamId: number; seasonId: number },
): RosterCan {
  if (actor.isAdmin || actor.managedOrgIds.has(params.organizationId)) {
    return { assignHeadCoach: true, manageCoaches: true, managePlayers: true };
  }
  const membership = actor.membershipFor(params.teamId, params.seasonId);
  if (!membership || membership.role !== "COACH") {
    return { assignHeadCoach: false, manageCoaches: false, managePlayers: false };
  }
  if (membership.isHeadCoach) {
    return { assignHeadCoach: false, manageCoaches: true, managePlayers: true };
  }
  return { assignHeadCoach: false, manageCoaches: false, managePlayers: true };
}

export function canManageRosterRole(
  can: RosterCan | null,
  role: "COACH" | "PLAYER",
): boolean {
  if (!can) return false;
  return role === "COACH" ? can.manageCoaches : can.managePlayers;
}

export function canManageMember(
  can: RosterCan | null,
  target: { role: "COACH" | "PLAYER"; isHeadCoach: boolean },
): boolean {
  if (!can) return false;
  // Head-coach rows are manager-only; this also blocks a head coach from
  // editing or removing their own row, so no userId comparison is needed.
  if (target.isHeadCoach) return can.assignHeadCoach;
  return target.role === "COACH" ? can.manageCoaches : can.managePlayers;
}

export default teamPolicy;
