import prisma from "../../../config/db.config.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";
import type { Actor } from "../../../authz/actor.ts";
import getPublicFileUrl from "../../../utils/getFileUrl.ts";
import { gregorianToJalali } from "../../../utils/date.util.ts";
import {
  leagueInclude,
  toLeagueResponse,
} from "../shared/league.mapper.ts";
import {
  buildAccess,
  groupRowsByTeam,
  loadLeagueContext,
  loadMyRosterRows,
  rolesForTeam,
  sortRoles,
  type LeagueRole,
} from "../shared/league.access.ts";
import { leaguePolicy, leagueTeamPolicy } from "./leagues.policy.ts";
import {
  autoAdvanceExpiredRegistrations,
  maybeAdvanceSingleLeague,
} from "../shared/league.auto.ts";

interface PublicLeagueListQuery {
  page: number;
  pageSize: number;
  status?: "REGISTRATION" | "ACTIVE" | "FINISHED";
  seasonId?: number;
  ageCategoryId?: number;
  search?: string;
}

async function listPublicLeagues(query: PublicLeagueListQuery, actor: Actor) {
  // Lifecycle: REGISTRATION → ACTIVE once the deadline passes.
  try {
    await autoAdvanceExpiredRegistrations();
  } catch {}
  const where: any = {
    status: query.status ?? { not: "INACTIVE" },
  };
  if (query.seasonId || query.ageCategoryId) {
    where.ageCategoryCutoff = {};
    if (query.seasonId) where.ageCategoryCutoff.seasonId = query.seasonId;
    if (query.ageCategoryId)
      where.ageCategoryCutoff.ageCategoryId = query.ageCategoryId;
  }
  const search = query.search?.trim();
  if (search) where.name = { contains: search };

  const [items, total] = await prisma.$transaction([
    prisma.league.findMany({
      where,
      orderBy: [{ id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: leagueInclude,
    }),
    prisma.league.count({ where }),
  ]);

  return {
    items: items.map((row) => ({
      ...toLeagueResponse(row),
      can: leaguePolicy(actor, {
        status: row.status,
        rosterDeadline: row.rosterDeadline,
      }),
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function getPublicLeague(leagueId: number, actor: Actor) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: leagueInclude,
  });
  if (!league) throw new AppError(404, messages.error.league.notFound);
  const effectiveStatus = await maybeAdvanceSingleLeague(league).catch(
    () => league.status,
  );
  if (effectiveStatus === "INACTIVE")
    throw new AppError(404, messages.error.league.notFound);
  return {
    ...toLeagueResponse({ ...league, status: effectiveStatus } as any),
    can: leaguePolicy(actor, {
      status: effectiveStatus as "REGISTRATION" | "ACTIVE" | "FINISHED",
      rosterDeadline: league.rosterDeadline,
    }),
  };
}

interface MyLeaguesQuery {
  page: number;
  pageSize: number;
  status?: "REGISTRATION" | "ACTIVE" | "FINISHED";
}

/** Conditions under which a league team is "mine" (manager of its org, or selected in its roster). */
function myLeagueTeamConditions(userId: number, actor: Actor) {
  const branches: any[] = [];
  if (actor.managedOrgIds.size > 0)
    branches.push({ team: { organizationId: { in: [...actor.managedOrgIds] } } });
  branches.push({
    members: {
      some: {
        status: "ACTIVE",
        teamSeasonMember: { userId, status: "ACTIVE" },
      },
    },
  });
  return {
    status: "ACTIVE",
    team: { status: { not: "DELETED" } },
    OR: branches,
  };
}

async function listMyLeagues(
  userId: number,
  query: MyLeaguesQuery,
  actor: Actor,
) {
  try {
    await autoAdvanceExpiredRegistrations();
  } catch {}
  const where: any = {
    status: query.status ?? { not: "INACTIVE" },
    teams: { some: myLeagueTeamConditions(userId, actor) },
  };

  const [leagues, total] = await prisma.$transaction([
    prisma.league.findMany({
      where,
      orderBy: [{ id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: leagueInclude,
    }),
    prisma.league.count({ where }),
  ]);

  const leagueIds = leagues.map((l) => l.id);
  const [managedTeams, rosterRows] =
    leagueIds.length === 0
      ? [[], []]
      : await Promise.all([
          actor.managedOrgIds.size === 0
            ? Promise.resolve([])
            : prisma.leagueTeam.findMany({
                where: {
                  leagueId: { in: leagueIds },
                  status: "ACTIVE",
                  team: {
                    status: { not: "DELETED" },
                    organizationId: { in: [...actor.managedOrgIds] },
                  },
                },
                select: { id: true, leagueId: true },
              }),
          loadMyRosterRows(userId, { leagueIds }),
        ]);

  const aggregates = new Map<
    number,
    { roles: Set<LeagueRole>; teamIds: Set<number> }
  >();
  const entryFor = (leagueId: number) => {
    let entry = aggregates.get(leagueId);
    if (!entry) {
      entry = { roles: new Set(), teamIds: new Set() };
      aggregates.set(leagueId, entry);
    }
    return entry;
  };
  for (const t of managedTeams) {
    const entry = entryFor(t.leagueId);
    entry.roles.add("MANAGER");
    entry.teamIds.add(t.id);
  }
  for (const row of rosterRows) {
    const entry = entryFor(row.leagueId);
    entry.roles.add(
      row.role === "COACH" && row.isHeadCoach ? "HEAD_COACH" : row.role,
    );
    entry.teamIds.add(row.leagueTeamId);
  }

  return {
    items: leagues.map((league) => {
      const entry = aggregates.get(league.id);
      return {
        league: toLeagueResponse(league),
        myRoles: entry ? sortRoles(entry.roles) : [],
        myTeamsCount: entry ? entry.teamIds.size : 0,
      };
    }),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function listMyTeams(leagueId: number, actor: Actor) {
  const league = await loadLeagueContext(leagueId, actor);
  const userId = actor.userId!;

  const leagueTeams = await prisma.leagueTeam.findMany({
    where: { leagueId, ...myLeagueTeamConditions(userId, actor) } as any,
    orderBy: [{ id: "asc" }],
    include: {
      team: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          organization: { select: { id: true, name: true } },
        },
      },
      _count: { select: { members: { where: { status: "ACTIVE" } } } },
    },
  });

  const rows = await loadMyRosterRows(userId, {
    leagueTeamIds: leagueTeams.map((lt) => lt.id),
  });
  const byTeam = groupRowsByTeam(rows);

  const items = leagueTeams.map((lt) => {
    const rowsForTeam = byTeam.get(lt.id) ?? [];
    const orgId = lt.team.organization.id;
    const access = buildAccess(actor, orgId, rowsForTeam, league.seasonId);
    return {
      leagueTeamId: lt.id,
      team: {
        id: lt.team.id,
        name: lt.team.name,
        logoUrl: getPublicFileUrl(lt.team.logoUrl, process.env.BASE_URL),
      },
      organization: lt.team.organization,
      myRoles: rolesForTeam(actor, orgId, rowsForTeam),
      membersCount: lt._count.members,
      can: leagueTeamPolicy(league, access),
    };
  });

  return {
    league: {
      id: league.id,
      name: league.name,
      status: league.status,
      rosterDeadline: gregorianToJalali(league.rosterDeadline),
    },
    items,
    total: items.length,
  };
}

async function getLeagueTeamDetail(
  leagueId: number,
  leagueTeamId: number,
  actor: Actor,
) {
  const league = await loadLeagueContext(leagueId, actor);
  const leagueTeam = await prisma.leagueTeam.findFirst({
    where: {
      id: leagueTeamId,
      leagueId,
      status: "ACTIVE",
      team: { status: { not: "DELETED" } },
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          organization: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!leagueTeam) throw new AppError(404, messages.error.leagueTeam.notFound);

  const [coaches, players, rows] = await Promise.all([
    prisma.leagueTeamMember.count({
      where: {
        leagueTeamId,
        status: "ACTIVE",
        teamSeasonMember: { role: "COACH" },
      },
    }),
    prisma.leagueTeamMember.count({
      where: {
        leagueTeamId,
        status: "ACTIVE",
        teamSeasonMember: { role: "PLAYER" },
      },
    }),
    loadMyRosterRows(actor.userId, { leagueTeamIds: [leagueTeamId] }),
  ]);

  const orgId = leagueTeam.team.organization.id;
  const access = buildAccess(actor, orgId, rows, league.seasonId);

  return {
    id: leagueTeam.id,
    league: {
      id: league.id,
      name: league.name,
      status: league.status,
      rosterDeadline: gregorianToJalali(league.rosterDeadline),
    },
    team: {
      id: leagueTeam.team.id,
      name: leagueTeam.team.name,
      logoUrl: getPublicFileUrl(leagueTeam.team.logoUrl, process.env.BASE_URL),
    },
    organization: leagueTeam.team.organization,
    counts: { coaches, players },
    myRoles: rolesForTeam(actor, orgId, rows),
    can: leagueTeamPolicy(league, access),
  };
}

export default {
  listPublicLeagues,
  getPublicLeague,
  listMyLeagues,
  listMyTeams,
  getLeagueTeamDetail,
};
