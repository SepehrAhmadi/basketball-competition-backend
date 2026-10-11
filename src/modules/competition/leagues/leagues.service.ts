import prisma from "../../../config/db.config.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";
import type { Actor } from "../../../authz/actor.ts";
import getPublicFileUrl from "../../../utils/getFileUrl.ts";
import {
  leagueInclude,
  toLeagueResponse,
} from "../shared/league.mapper.ts";
import { leaguePolicy, leagueTeamPolicy } from "./leagues.policy.ts";

interface PublicLeagueListQuery {
  page: number;
  pageSize: number;
  status?: "REGISTRATION" | "ACTIVE" | "FINISHED";
  seasonId?: number;
  ageCategoryId?: number;
  search?: string;
}

async function listPublicLeagues(query: PublicLeagueListQuery, actor: Actor) {
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
  if (!league || league.status === "INACTIVE")
    throw new AppError(404, messages.error.league.notFound);
  return {
    ...toLeagueResponse(league),
    can: leaguePolicy(actor, {
      status: league.status,
      rosterDeadline: league.rosterDeadline,
    }),
  };
}

interface MyLeaguesQuery {
  page: number;
  pageSize: number;
  status?: "REGISTRATION" | "ACTIVE" | "FINISHED";
}

async function listMyLeagues(
  userId: number,
  query: MyLeaguesQuery,
  actor: Actor,
) {
  const leagueWhere: any = { status: { not: "INACTIVE" } };
  if (query.status) leagueWhere.status = query.status;

  const [managerRows, memberRows] = await Promise.all([
    actor.managedOrgIds.size === 0
      ? Promise.resolve([])
      : prisma.leagueTeam.findMany({
          where: {
            status: "ACTIVE",
            team: {
              status: { not: "DELETED" },
              organizationId: { in: [...actor.managedOrgIds] },
            },
            league: leagueWhere,
          },
          include: {
            league: { include: leagueInclude },
            team: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
                organization: { select: { id: true, name: true } },
              },
            },
          },
        }),
    prisma.leagueTeamMember.findMany({
      where: {
        status: "ACTIVE",
        teamSeasonMember: { userId, status: "ACTIVE" },
        leagueTeam: {
          status: "ACTIVE",
          team: { status: { not: "DELETED" } },
          league: leagueWhere,
        },
      },
      include: {
        leagueTeam: {
          include: {
            league: { include: leagueInclude },
            team: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
                organization: { select: { id: true, name: true } },
              },
            },
          },
        },
        teamSeasonMember: { select: { role: true } },
      },
    }),
  ]);

  const byLeague = new Map<
    number,
    {
      league: any;
      teams: Map<
        number,
        {
          leagueTeamId: number;
          team: { id: number; name: string; logoUrl: string | null };
          organization: { id: number; name: string };
          roles: Set<string>;
        }
      >;
    }
  >();

  for (const row of managerRows) {
    let entry = byLeague.get(row.leagueId);
    if (!entry) {
      entry = { league: row.league, teams: new Map() };
      byLeague.set(row.leagueId, entry);
    }
    if (!entry.teams.has(row.id)) {
      entry.teams.set(row.id, {
        leagueTeamId: row.id,
        team: {
          id: row.team.id,
          name: row.team.name,
          logoUrl: getPublicFileUrl(row.team.logoUrl, process.env.BASE_URL),
        },
        organization: row.team.organization,
        roles: new Set(["MANAGER"]),
      });
    } else {
      entry.teams.get(row.id)!.roles.add("MANAGER");
    }
  }

  for (const row of memberRows) {
    const lt = row.leagueTeam;
    let entry = byLeague.get(lt.leagueId);
    if (!entry) {
      entry = { league: lt.league, teams: new Map() };
      byLeague.set(lt.leagueId, entry);
    }
    const existing = entry.teams.get(lt.id);
    if (!existing) {
      entry.teams.set(lt.id, {
        leagueTeamId: lt.id,
        team: {
          id: lt.team.id,
          name: lt.team.name,
          logoUrl: getPublicFileUrl(lt.team.logoUrl, process.env.BASE_URL),
        },
        organization: lt.team.organization,
        roles: new Set([row.teamSeasonMember.role]),
      });
    } else {
      existing.roles.add(row.teamSeasonMember.role);
    }
  }

  const grouped = [...byLeague.values()]
    .map((entry) => ({
      league: toLeagueResponse(entry.league),
      myTeams: [...entry.teams.values()].map((t) => ({
        leagueTeamId: t.leagueTeamId,
        team: t.team,
        organization: t.organization,
        roles: [...t.roles],
        can: leagueTeamPolicy(
          actor,
          {
            status: entry.league.status,
            rosterDeadline: entry.league.rosterDeadline,
          },
          t.organization.id,
        ),
      })),
    }))
    .sort((a, b) => b.league.id - a.league.id);

  const total = grouped.length;
  const items = grouped.slice(
    (query.page - 1) * query.pageSize,
    query.page * query.pageSize,
  );

  return { items, total, page: query.page, pageSize: query.pageSize };
}

export default {
  listPublicLeagues,
  getPublicLeague,
  listMyLeagues,
};
