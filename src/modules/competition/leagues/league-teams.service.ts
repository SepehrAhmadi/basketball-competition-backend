import prisma from "../../../config/db.config.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";
import type { Actor } from "../../../authz/actor.ts";
import { gregorianToJalali } from "../../../utils/date.util.ts";
import getPublicFileUrl from "../../../utils/getFileUrl.ts";
import {
  canEditByStatus,
  isPlayerAgeEligible,
  isRosterWindowOpen,
} from "../shared/league.rules.ts";
import { toLeagueTeamItem } from "../shared/league.mapper.ts";
import { leagueTeamPolicy } from "./leagues.policy.ts";

export function adminActor(callerUserId: number): Actor {
  return {
    userId: callerUserId,
    isAdmin: true,
    managedOrgIds: new Set<number>(),
    memberOrgIds: new Set<number>(),
    memberTeamIds: new Set<number>(),
    membershipFor: () => undefined,
  };
}

interface LeagueContext {
  id: number;
  status: "INACTIVE" | "REGISTRATION" | "ACTIVE" | "FINISHED";
  rosterDeadline: Date | null;
  seasonId: number;
  minBirthDate: Date;
}

async function loadLeagueForActor(
  leagueId: number,
  actor: Actor,
): Promise<LeagueContext> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { ageCategoryCutoff: { select: { seasonId: true, minBirthDate: true } } },
  });
  if (!league) throw new AppError(404, messages.error.league.notFound);
  if (league.status === "INACTIVE" && !actor.isAdmin)
    throw new AppError(404, messages.error.league.notFound);
  return {
    id: league.id,
    status: league.status,
    rosterDeadline: league.rosterDeadline,
    seasonId: league.ageCategoryCutoff.seasonId,
    minBirthDate: league.ageCategoryCutoff.minBirthDate,
  };
}

function assertCanEdit(
  actor: Actor,
  league: LeagueContext,
  organizationId: number,
) {
  if (!actor.isAdmin && !actor.managedOrgIds.has(organizationId))
    throw new AppError(403, messages.error.league.notAuthorized);
  if (!canEditByStatus(league.status, actor.isAdmin))
    throw new AppError(409, messages.error.league.registrationClosed);
  if (!actor.isAdmin && !isRosterWindowOpen(league.rosterDeadline))
    throw new AppError(409, messages.error.league.rosterClosed);
}

const leagueTeamInclude = {
  team: {
    select: {
      id: true,
      name: true,
      logoUrl: true,
      status: true,
      organization: { select: { id: true, name: true } },
    },
  },
} as const;

function toTeamItem(
  row: {
    id: number;
    status: string;
    createdAt: Date;
    team: { id: number; name: string; logoUrl: string | null; organization: { id: number; name: string } };
    _count: { members: number };
  },
  actor: Actor,
  league: LeagueContext,
) {
  const can = actor.userId === null && !actor.isAdmin
    ? { manageRoster: false, unregister: false }
    : leagueTeamPolicy(actor, league, row.team.organization.id);
  return toLeagueTeamItem(
    {
      id: row.id,
      status: row.status,
      createdAt: row.createdAt,
      team: { id: row.team.id, name: row.team.name, logoUrl: row.team.logoUrl },
      organization: row.team.organization,
      membersCount: row._count.members,
    },
    can,
  );
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
  const league = await loadLeagueForActor(leagueId, actor);
  const search = query.search?.trim();
  const where: any = {
    leagueId,
    status: "ACTIVE",
    team: { status: { not: "DELETED" } },
  };
  if (search) where.team = { ...where.team, name: { contains: search } };

  const [items, total] = await prisma.$transaction([
    prisma.leagueTeam.findMany({
      where,
      orderBy: [{ id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        ...leagueTeamInclude,
        _count: { select: { members: { where: { status: "ACTIVE" } } } },
      },
    }),
    prisma.leagueTeam.count({ where }),
  ]);

  return {
    items: items.map((row) => toTeamItem(row, actor, league)),
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
  const league = await loadLeagueForActor(leagueId, actor);
  const search = query.search?.trim();
  const where: any = {
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
  const league = await loadLeagueForActor(leagueId, actor);

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { organization: { select: { id: true, status: true } } },
  });
  if (!team || team.status === "DELETED")
    throw new AppError(404, messages.error.team.notFound);

  assertCanEdit(actor, league, team.organizationId);

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
  try {
    let row;
    if (existing) {
      if (existing.status === "ACTIVE")
        throw new AppError(409, messages.error.leagueTeam.alreadyRegistered);
      row = await prisma.leagueTeam.update({
        where: { id: existing.id },
        data: { status: "ACTIVE" },
        include: {
          ...leagueTeamInclude,
          _count: { select: { members: { where: { status: "ACTIVE" } } } },
        },
      });
    } else {
      row = await prisma.leagueTeam.create({
        data: { leagueId, teamId, status: "ACTIVE" },
        include: {
          ...leagueTeamInclude,
          _count: { select: { members: { where: { status: "ACTIVE" } } } },
        },
      });
    }
    return toTeamItem(row, actor, league);
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
  const league = await loadLeagueForActor(leagueId, actor);
  const leagueTeam = await prisma.leagueTeam.findFirst({
    where: { id: leagueTeamId, leagueId, status: "ACTIVE" },
    include: { team: { select: { organizationId: true } } },
  });
  if (!leagueTeam)
    throw new AppError(404, messages.error.leagueTeam.notFound);

  assertCanEdit(actor, league, leagueTeam.team.organizationId);

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

async function loadLeagueTeamForActor(
  league: LeagueContext,
  leagueTeamId: number,
  actor: Actor,
) {
  const leagueTeam = await prisma.leagueTeam.findFirst({
    where: { id: leagueTeamId, leagueId: league.id, status: "ACTIVE" },
    include: { team: { select: { id: true, organizationId: true } } },
  });
  if (!leagueTeam)
    throw new AppError(404, messages.error.leagueTeam.notFound);
  if (!actor.isAdmin && !actor.managedOrgIds.has(leagueTeam.team.organizationId))
    throw new AppError(403, messages.error.league.notAuthorized);
  return leagueTeam;
}

interface MembersQuery {
  page: number;
  pageSize: number;
  role?: "COACH" | "PLAYER";
}

const memberInclude = {
  teamSeasonMember: {
    select: {
      id: true,
      role: true,
      jerseyNumber: true,
      isHeadCoach: true,
      user: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          phone: true,
          birthDate: true,
        },
      },
    },
  },
} as const;

function toMemberRow(row: {
  id: number;
  teamSeasonMember: {
    id: number;
    role: string;
    jerseyNumber: number | null;
    isHeadCoach: boolean;
    user: {
      id: number;
      fullName: string;
      avatarUrl: string | null;
      phone: string;
      birthDate: Date | null;
    };
  };
}) {
  return {
    id: row.id,
    teamSeasonMemberId: row.teamSeasonMember.id,
    userId: row.teamSeasonMember.user.id,
    fullName: row.teamSeasonMember.user.fullName,
    avatarUrl: getPublicFileUrl(
      row.teamSeasonMember.user.avatarUrl,
      process.env.BASE_URL,
    ),
    role: row.teamSeasonMember.role,
    jerseyNumber: row.teamSeasonMember.jerseyNumber,
    isHeadCoach: row.teamSeasonMember.isHeadCoach,
    phone: row.teamSeasonMember.user.phone,
    birthDate: gregorianToJalali(row.teamSeasonMember.user.birthDate),
  };
}

async function listMembers(
  leagueId: number,
  leagueTeamId: number,
  query: MembersQuery,
  actor: Actor,
  options: { admin: boolean },
) {
  const league = await loadLeagueForActor(leagueId, actor);
  const leagueTeam = await loadLeagueTeamForActor(league, leagueTeamId, actor);
  const where: any = { leagueTeamId, status: "ACTIVE" };
  if (query.role) where.teamSeasonMember = { role: query.role };

  const [items, total] = await prisma.$transaction([
    prisma.leagueTeamMember.findMany({
      where,
      orderBy: [{ id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: memberInclude,
    }),
    prisma.leagueTeamMember.count({ where }),
  ]);

  const rows = items.map(toMemberRow);
  const can = leagueTeamPolicy(actor, league, leagueTeam.team.organizationId);
  return {
    items: options.admin
      ? rows
      : rows.map(
          ({
            phone: _phone,
            birthDate: _birthDate,
            ...safe
          }) => safe,
        ),
    total,
    page: query.page,
    pageSize: query.pageSize,
    can,
  };
}

interface CandidatesQuery extends MembersQuery {
  search?: string;
}

async function listCandidates(
  leagueId: number,
  leagueTeamId: number,
  query: CandidatesQuery,
  actor: Actor,
  options: { admin: boolean },
) {
  const league = await loadLeagueForActor(leagueId, actor);
  const leagueTeam = await loadLeagueTeamForActor(league, leagueTeamId, actor);
  const search = query.search?.trim();
  const where: any = {
    teamId: leagueTeam.team.id,
    seasonId: league.seasonId,
    status: "ACTIVE",
    user: { status: "ACTIVE" },
  };
  if (query.role) where.role = query.role;
  if (search) {
    where.user = {
      ...where.user,
      OR: [{ fullName: { contains: search } }, { phone: { contains: search } }],
    };
  }

  const [members, selected, otherTeams] = await prisma.$transaction([
    prisma.teamSeasonMember.findMany({
      where,
      orderBy: [{ id: "asc" }],
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            phone: true,
            birthDate: true,
          },
        },
      },
    }),
    prisma.leagueTeamMember.findMany({
      where: { leagueTeamId, status: "ACTIVE" },
      select: { teamSeasonMemberId: true },
    }),
    prisma.leagueTeamMember.findMany({
      where: {
        status: "ACTIVE",
        leagueTeam: { leagueId, status: "ACTIVE", id: { not: leagueTeamId } },
        teamSeasonMember: { role: "PLAYER" },
      },
      select: { teamSeasonMember: { select: { userId: true } } },
    }),
  ]);
  const selectedIds = new Set(selected.map((s) => s.teamSeasonMemberId));
  const otherUserIds = new Set(otherTeams.map((o) => o.teamSeasonMember.userId));

  const items = members.map((m) => {
    let eligible = true;
    let ineligibleReason: string | null = null;
    if (m.role === "PLAYER") {
      const age = isPlayerAgeEligible(m.user.birthDate, league.minBirthDate);
      if (!age.ok) {
        eligible = false;
        ineligibleReason = age.reason;
      } else if (otherUserIds.has(m.userId)) {
        eligible = false;
        ineligibleReason = "IN_OTHER_TEAM";
      }
    }
    const base = {
      teamSeasonMemberId: m.id,
      userId: m.userId,
      fullName: m.user.fullName,
      avatarUrl: getPublicFileUrl(m.user.avatarUrl, process.env.BASE_URL),
      role: m.role,
      jerseyNumber: m.jerseyNumber,
      isHeadCoach: m.isHeadCoach,
      selected: selectedIds.has(m.id),
      eligible,
      ineligibleReason,
    };
    return options.admin
      ? {
          ...base,
          phone: m.user.phone,
          birthDate: gregorianToJalali(m.user.birthDate),
        }
      : base;
  });

  return { items, total: items.length };
}

async function addMembers(
  leagueId: number,
  leagueTeamId: number,
  teamSeasonMemberIds: number[],
  actor: Actor,
) {
  const league = await loadLeagueForActor(leagueId, actor);
  const leagueTeam = await loadLeagueTeamForActor(league, leagueTeamId, actor);
  assertCanEdit(actor, league, leagueTeam.team.organizationId);

  const ids = [...new Set(teamSeasonMemberIds)];
  const rows = await prisma.teamSeasonMember.findMany({
    where: {
      id: { in: ids },
      teamId: leagueTeam.team.id,
      seasonId: league.seasonId,
      status: "ACTIVE",
      user: { status: "ACTIVE" },
    },
    include: { user: { select: { id: true, birthDate: true } } },
  });
  if (rows.length !== ids.length)
    throw new AppError(404, messages.error.leagueRoster.teamMemberNotFound);

  for (const row of rows) {
    if (row.role === "PLAYER") {
      const age = isPlayerAgeEligible(row.user.birthDate, league.minBirthDate);
      if (!age.ok) {
        throw new AppError(
          400,
          age.reason === "BIRTH_DATE_MISSING"
            ? messages.error.leagueRoster.birthDateRequired
            : messages.error.leagueRoster.ageIneligible,
        );
      }
      const clash = await prisma.leagueTeamMember.findFirst({
        where: {
          status: "ACTIVE",
          leagueTeam: { leagueId, status: "ACTIVE", id: { not: leagueTeamId } },
          teamSeasonMember: { userId: row.userId, role: "PLAYER" },
        },
      });
      if (clash)
        throw new AppError(409, messages.error.leagueRoster.playerInOtherTeam);
    }
  }

  const existing = await prisma.leagueTeamMember.findMany({
    where: { leagueTeamId, teamSeasonMemberId: { in: ids } },
  });
  const byMemberId = new Map(existing.map((e) => [e.teamSeasonMemberId, e]));
  for (const id of ids) {
    if (byMemberId.get(id)?.status === "ACTIVE")
      throw new AppError(409, messages.error.leagueRoster.alreadyInRoster);
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const out = [];
      for (const id of ids) {
        const row = byMemberId.get(id);
        if (row) {
          out.push(
            await tx.leagueTeamMember.update({
              where: { id: row.id },
              data: { status: "ACTIVE" },
              include: memberInclude,
            }),
          );
        } else {
          out.push(
            await tx.leagueTeamMember.create({
              data: {
                leagueTeamId,
                teamSeasonMemberId: id,
                status: "ACTIVE",
              },
              include: memberInclude,
            }),
          );
        }
      }
      return out;
    });
    return created.map((r) => {
      const { phone: _phone, birthDate: _birthDate, ...safe } = toMemberRow(r);
      return safe;
    });
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    if (err?.code === "P2002")
      throw new AppError(409, messages.error.leagueRoster.alreadyInRoster);
    throw err;
  }
}

async function removeMember(
  leagueId: number,
  leagueTeamId: number,
  memberId: number,
  actor: Actor,
) {
  const league = await loadLeagueForActor(leagueId, actor);
  const leagueTeam = await loadLeagueTeamForActor(league, leagueTeamId, actor);
  assertCanEdit(actor, league, leagueTeam.team.organizationId);

  const row = await prisma.leagueTeamMember.findFirst({
    where: { id: memberId, leagueTeamId, status: "ACTIVE" },
  });
  if (!row) throw new AppError(404, messages.error.leagueRoster.notFound);

  await prisma.leagueTeamMember.update({
    where: { id: memberId },
    data: { status: "DELETED" },
  });
}

export default {
  adminActor,
  listLeagueTeams,
  listEligibleTeams,
  registerTeam,
  unregisterTeam,
  listMembers,
  listCandidates,
  addMembers,
  removeMember,
};
