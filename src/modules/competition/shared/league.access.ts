import prisma from "../../../config/db.config.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";
import type { Actor } from "../../../authz/actor.ts";
import { maybeAdvanceSingleLeague } from "./league.auto.ts";

export type RosterRole = "ADMIN" | "MANAGER" | "HEAD_COACH" | null;

export interface LeagueTeamAccess {
  rosterRole: RosterRole;
  // teamSeasonMemberId of the caller's own league-roster row, if any
  ownTeamSeasonMemberId: number | null;
}

export type LeagueRole = "MANAGER" | "HEAD_COACH" | "COACH" | "PLAYER";

export const LEAGUE_ROLE_ORDER: readonly LeagueRole[] = [
  "MANAGER",
  "HEAD_COACH",
  "COACH",
  "PLAYER",
];

export interface LeagueContext {
  id: number;
  name: string;
  status: "INACTIVE" | "REGISTRATION" | "ACTIVE" | "FINISHED";
  rosterDeadline: Date | null;
  seasonId: number;
  minBirthDate: Date;
}

export interface MyRosterRow {
  leagueId: number;
  leagueTeamId: number;
  teamSeasonMemberId: number;
  role: "COACH" | "PLAYER";
  isHeadCoach: boolean;
  seasonId: number;
}

export async function loadLeagueContext(
  leagueId: number,
  actor: Actor,
): Promise<LeagueContext> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      ageCategoryCutoff: { select: { seasonId: true, minBirthDate: true } },
    },
  });
  if (!league) throw new AppError(404, messages.error.league.notFound);
  // Lifecycle: REGISTRATION → ACTIVE once the deadline passes.
  // Best-effort so a stale stored status never blocks reads.
  const effectiveStatus = await maybeAdvanceSingleLeague(league).catch(
    () => league.status,
  );
  if (effectiveStatus === "INACTIVE" && !actor.isAdmin)
    throw new AppError(404, messages.error.league.notFound);
  return {
    id: league.id,
    name: league.name,
    status: effectiveStatus as LeagueContext["status"],
    rosterDeadline: league.rosterDeadline,
    seasonId: league.ageCategoryCutoff.seasonId,
    minBirthDate: league.ageCategoryCutoff.minBirthDate,
  };
}

function isLeagueHeadCoachRow(row: MyRosterRow, seasonId: number): boolean {
  return row.role === "COACH" && row.isHeadCoach && row.seasonId === seasonId;
}

/**
 * Loads the caller's ACTIVE league-roster rows in one query. Only the
 * league-season membership is considered (not `actor.memberTeamIds`, which
 * only covers the currently active season).
 */
export async function loadMyRosterRows(
  userId: number | null,
  filter: { leagueTeamIds?: number[]; leagueIds?: number[] },
): Promise<MyRosterRow[]> {
  if (userId === null) return [];
  const rows = await prisma.leagueTeamMember.findMany({
    where: {
      status: "ACTIVE",
      teamSeasonMember: { userId, status: "ACTIVE" },
      leagueTeam: {
        status: "ACTIVE",
        team: { status: { not: "DELETED" } },
        ...(filter.leagueTeamIds ? { id: { in: filter.leagueTeamIds } } : {}),
        ...(filter.leagueIds ? { leagueId: { in: filter.leagueIds } } : {}),
      },
    },
    select: {
      leagueTeamId: true,
      leagueTeam: { select: { leagueId: true } },
      teamSeasonMember: {
        select: { id: true, role: true, isHeadCoach: true, seasonId: true },
      },
    },
  });
  return rows.map((r) => ({
    leagueId: r.leagueTeam.leagueId,
    leagueTeamId: r.leagueTeamId,
    teamSeasonMemberId: r.teamSeasonMember.id,
    role: r.teamSeasonMember.role,
    isHeadCoach: r.teamSeasonMember.isHeadCoach,
    seasonId: r.teamSeasonMember.seasonId,
  }));
}

/** Pure: derives access from already-loaded facts. */
export function buildAccess(
  actor: Actor,
  organizationId: number,
  rowsForTeam: MyRosterRow[],
  leagueSeasonId: number,
): LeagueTeamAccess {
  if (actor.isAdmin)
    return { rosterRole: "ADMIN", ownTeamSeasonMemberId: null };
  if (actor.userId === null)
    return { rosterRole: null, ownTeamSeasonMemberId: null };
  const own = rowsForTeam.find((r) => isLeagueHeadCoachRow(r, leagueSeasonId));
  if (actor.managedOrgIds.has(organizationId))
    return {
      rosterRole: "MANAGER",
      ownTeamSeasonMemberId: own?.teamSeasonMemberId ?? null,
    };
  if (own)
    return { rosterRole: "HEAD_COACH", ownTeamSeasonMemberId: own.teamSeasonMemberId };
  return { rosterRole: null, ownTeamSeasonMemberId: null };
}

/** Pure: roles the caller has on one league team, ordered MANAGER..PLAYER. */
export function rolesForTeam(
  actor: Actor,
  organizationId: number,
  rowsForTeam: MyRosterRow[],
): LeagueRole[] {
  const roles = new Set<LeagueRole>();
  if (actor.managedOrgIds.has(organizationId)) roles.add("MANAGER");
  for (const row of rowsForTeam) {
    roles.add(row.role === "COACH" && row.isHeadCoach ? "HEAD_COACH" : row.role);
  }
  return sortRoles(roles);
}

export function sortRoles(roles: Iterable<LeagueRole>): LeagueRole[] {
  const set = new Set(roles);
  return LEAGUE_ROLE_ORDER.filter((r) => set.has(r));
}

/**
 * Single league team. Admin and manager need no query; everybody else costs
 * exactly one query.
 */
export async function resolveLeagueTeamAccess(
  actor: Actor,
  leagueTeam: { id: number; team: { organizationId: number } },
  league: { seasonId: number },
): Promise<LeagueTeamAccess> {
  if (actor.isAdmin)
    return { rosterRole: "ADMIN", ownTeamSeasonMemberId: null };
  if (actor.userId === null)
    return { rosterRole: null, ownTeamSeasonMemberId: null };

  const own = await prisma.leagueTeamMember.findFirst({
    where: {
      leagueTeamId: leagueTeam.id,
      status: "ACTIVE",
      teamSeasonMember: {
        userId: actor.userId,
        role: "COACH",
        isHeadCoach: true,
        status: "ACTIVE",
        seasonId: league.seasonId,
      },
    },
    select: { teamSeasonMemberId: true },
  });
  if (actor.managedOrgIds.has(leagueTeam.team.organizationId))
    return {
      rosterRole: "MANAGER",
      ownTeamSeasonMemberId: own?.teamSeasonMemberId ?? null,
    };
  if (own)
    return { rosterRole: "HEAD_COACH", ownTeamSeasonMemberId: own.teamSeasonMemberId };
  return { rosterRole: null, ownTeamSeasonMemberId: null };
}

/** Batch variant for lists: one query regardless of the number of teams. */
export async function resolveAccessMap(
  actor: Actor,
  league: { seasonId: number },
  leagueTeams: { id: number; organizationId: number }[],
): Promise<Map<number, LeagueTeamAccess>> {
  const rows =
    actor.isAdmin || actor.userId === null || leagueTeams.length === 0
      ? []
      : await loadMyRosterRows(actor.userId, {
          leagueTeamIds: leagueTeams.map((t) => t.id),
        });
  const byTeam = groupRowsByTeam(rows);
  const out = new Map<number, LeagueTeamAccess>();
  for (const lt of leagueTeams) {
    out.set(
      lt.id,
      buildAccess(actor, lt.organizationId, byTeam.get(lt.id) ?? [], league.seasonId),
    );
  }
  return out;
}

export function groupRowsByTeam(rows: MyRosterRow[]): Map<number, MyRosterRow[]> {
  const byTeam = new Map<number, MyRosterRow[]>();
  for (const row of rows) {
    const list = byTeam.get(row.leagueTeamId);
    if (list) list.push(row);
    else byTeam.set(row.leagueTeamId, [row]);
  }
  return byTeam;
}

export default {
  loadLeagueContext,
  loadMyRosterRows,
  buildAccess,
  rolesForTeam,
  sortRoles,
  resolveLeagueTeamAccess,
  resolveAccessMap,
  groupRowsByTeam,
};
