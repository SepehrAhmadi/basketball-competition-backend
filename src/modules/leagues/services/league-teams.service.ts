import prisma from "../../../config/db.config.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";
import type { Actor } from "../../../authz/actor.ts";
import type { Prisma } from "../../../prisma/generated/prisma/client.ts";
import getPublicFileUrl from "../../../utils/getFileUrl.ts";
import {
  activeLeagueTeamWhere,
  leagueTeamListInclude,
  toLeagueTeamListItem,
} from "../lib/league.mapper.ts";
import {
  loadLeagueContext,
  loadLeagueTeam,
  resolveAccessMap,
} from "../lib/league.access.ts";
import type {
  LeagueContext,
  LeagueTeamAccess,
} from "../lib/league.types.ts";
import { addHeadCoachToLeagueRoster } from "../lib/league.head-coach-sync.ts";
import {
  evaluateRegister,
  evaluateUnregister,
  leagueTeamPolicy,
  throwDenial,
} from "../leagues.policy.ts";

/** Registration (and unregistration) is for admins and organization managers only. */
function assertCanRegister(
  actor: Actor,
  league: LeagueContext,
  organizationId: number,
) {
  const result = evaluateRegister(actor, league, organizationId);
  if (!result.allowed) throwDenial(result.reason);
}


interface LeagueTeamsQuery {
  page: number;
  pageSize: number;
  search?: string;
}

async function listLeagueTeams(
  leagueId: number,
  query: LeagueTeamsQuery,
  actor: Actor,
) {
  const league = await loadLeagueContext(leagueId, actor);
  const search = query.search?.trim();
  const where: Prisma.LeagueTeamWhereInput = activeLeagueTeamWhere(leagueId);
  if (search)
    where.team = {
      status: { not: "DELETED" },
      name: { contains: search },
    };

  const [items, total] = await prisma.$transaction([
    prisma.leagueTeam.findMany({
      where,
      orderBy: [{ id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: leagueTeamListInclude,
    }),
    prisma.leagueTeam.count({ where }),
  ]);

  const accessMap = await resolveAccessMap(
    actor,
    league,
    items.map((i) => ({ id: i.id, organizationId: i.team.organization.id })),
  );

  return {
    items: items.map((row) =>
      toLeagueTeamListItem(row, leagueTeamPolicy(league, accessMap.get(row.id)!)),
    ),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

interface EligibleTeamsQuery extends LeagueTeamsQuery {
  organizationId?: number;
}

async function listEligibleTeams(
  leagueId: number,
  query: EligibleTeamsQuery,
  actor: Actor,
) {
  const league = await loadLeagueContext(leagueId, actor);
  const search = query.search?.trim();
  const where: Prisma.TeamWhereInput = {
    status: "ACTIVE",
    organization: { status: "ACTIVE" },
    members: {
      some: {
        seasonId: league.seasonId,
        status: "ACTIVE",
        user: { status: "ACTIVE" },
      },
    },
  };
  if (!actor.isAdmin) {
    if (actor.managedOrgIds.size === 0)
      return { items: [], total: 0, page: query.page, pageSize: query.pageSize };
    where.organizationId = { in: [...actor.managedOrgIds] };
  } else if (query.organizationId) {
    where.organizationId = query.organizationId;
  }
  if (search) where.name = { contains: search };

  const [teams, total, registered] = await prisma.$transaction([
    prisma.team.findMany({
      where,
      orderBy: [{ id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        organization: { select: { id: true, name: true } },
        _count: {
          select: {
            members: {
              where: {
                seasonId: league.seasonId,
                status: "ACTIVE",
                user: { status: "ACTIVE" },
              },
            },
          },
        },
      },
    }),
    prisma.team.count({ where }),
    prisma.leagueTeam.findMany({
      where: { leagueId, status: "ACTIVE" },
      select: { teamId: true },
    }),
  ]);
  const registeredIds = new Set(registered.map((r) => r.teamId));

  return {
    items: teams.map((t) => ({
      team: {
        id: t.id,
        name: t.name,
        logoUrl: getPublicFileUrl(t.logoUrl, process.env.BASE_URL),
      },
      organization: t.organization,
      activeRosterCount: t._count.members,
      alreadyRegistered: registeredIds.has(t.id),
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function registerTeam(leagueId: number, teamId: number, actor: Actor) {
  const league = await loadLeagueContext(leagueId, actor);

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { organization: { select: { id: true, status: true } } },
  });
  if (!team || team.status === "DELETED")
    throw new AppError(404, messages.error.team.notFound);

  assertCanRegister(actor, league, team.organizationId);

  if (team.status !== "ACTIVE" || team.organization.status !== "ACTIVE")
    throw new AppError(400, messages.error.leagueTeam.teamNotActive);

  const seasonRoster = await prisma.teamSeasonMember.count({
    where: {
      teamId,
      seasonId: league.seasonId,
      status: "ACTIVE",
      user: { status: "ACTIVE" },
    },
  });
  if (seasonRoster === 0)
    throw new AppError(400, messages.error.leagueTeam.noSeasonRoster);

  const existing = await prisma.leagueTeam.findUnique({
    where: { leagueId_teamId: { leagueId, teamId } },
  });
  if (existing?.status === "ACTIVE")
    throw new AppError(409, messages.error.leagueTeam.alreadyRegistered);

  try {
    const row = await prisma.$transaction(async (tx) => {
      const leagueTeamId = existing
        ? (
            await tx.leagueTeam.update({
              where: { id: existing.id },
              data: { status: "ACTIVE" },
            })
          ).id
        : (
            await tx.leagueTeam.create({
              data: { leagueId, teamId, status: "ACTIVE" },
            })
          ).id;
      await addHeadCoachToLeagueRoster(tx, {
        leagueTeamId,
        teamId,
        seasonId: league.seasonId,
      });
      return tx.leagueTeam.findUniqueOrThrow({
        where: { id: leagueTeamId },
        include: leagueTeamListInclude,
      });
    });
    // The caller passed assertCanRegister, so they are an admin or a manager.
    const access: LeagueTeamAccess = {
      rosterRole: actor.isAdmin ? "ADMIN" : "MANAGER",
      ownTeamSeasonMemberId: null,
    };
    return toLeagueTeamListItem(row, leagueTeamPolicy(league, access));
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    if (err?.code === "P2002")
      throw new AppError(409, messages.error.leagueTeam.alreadyRegistered);
    throw err;
  }
}

async function unregisterTeam(
  leagueId: number,
  leagueTeamId: number,
  actor: Actor,
) {
  const league = await loadLeagueContext(leagueId, actor);
  const leagueTeam = await loadLeagueTeam(league, leagueTeamId);

  const result = evaluateUnregister(
    actor,
    league,
    leagueTeam.team.organizationId,
  );
  if (!result.allowed) throwDenial(result.reason);

  await prisma.$transaction([
    prisma.leagueTeam.update({
      where: { id: leagueTeamId },
      data: { status: "DELETED" },
    }),
    prisma.leagueTeamMember.updateMany({
      where: { leagueTeamId, status: "ACTIVE" },
      data: { status: "DELETED" },
    }),
  ]);
}

export default {
  listLeagueTeams,
  listEligibleTeams,
  registerTeam,
  unregisterTeam,
};
