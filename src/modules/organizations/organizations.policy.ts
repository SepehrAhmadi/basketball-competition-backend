import type { Actor } from "../../authz/actor.ts";

export interface OrganizationCan {
  view: boolean;
  edit: boolean;
  delete: boolean;
  createTeam: boolean;
}

export function organizationPolicy(actor: Actor, organizationId: number): OrganizationCan {
  if (actor.isAdmin) {
    return { view: true, edit: true, delete: true, createTeam: true };
  }
  const isManager = actor.managedOrgIds.has(organizationId);
  if (isManager) {
    return { view: true, edit: true, delete: true, createTeam: true };
  }
  const isMember = actor.memberOrgIds.has(organizationId);
  return { view: isMember, edit: false, delete: false, createTeam: false };
}

export default organizationPolicy;
