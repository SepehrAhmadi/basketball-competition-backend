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
import {
  memberOrderBy,
  teamSeasonMemberOrderBy,
  toAdminMemberItem,
  toLeagueTeamItem,
  toLeagueTeamMemberRow,
  toPublicMemberItem,
} from "../shared/league.mapper.ts";
import {
  loadLeagueContext,
  resolveAccessMap,
  resolveLeagueTeamAccess,
  type LeagueContext,
  type LeagueTeamAccess,
} from "../shared/league.access.ts";
import { addHeadCoachToLeagueRoster } from "../shared/league.headcoach.sync.ts";
import { leagueTeamPolicy, rosterRowPolicy } from "./leagues.policy.ts";

/** Registration (and unregistration) is for admins and organization managers only. */
function assertCanRegister(
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

/** Identity → status → window, using the role-specific rule. */
function assertRosterEditable(access: LeagueTeamAccess, league: LeagueContext) {
  if (access.rosterRole === null)
    throw new AppError(403, messages.error.league.notAuthorized);
  const isAdmin = access.rosterRole === "ADMIN";
  if (!canEditByStatus(league.status, isAdmin))
    throw new AppError(409, messages.error.league.registrationClosed);
  if (!isAdmin && !isRosterWindowOpen(league.rosterDeadline))
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

const leagueTeamListInclude = {
  ...leagueTeamInclude,
  _count: { select: { members: { where: { status: "ACTIVE" } } } },
} as const;

function toTeamItem(
  row: {
    id: number;
    status: string;
    createdAt: Date;
    team: {
      id: number;
      name: string;
      logoUrl: string | null;
      organization: { id: number; name: string };
    };
    _count: { members: number };
  },
  can: ReturnType<typeof leagueTeamPolicy>,
) {
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
  const league = await loadLeagueContext(leagueId, actor);
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
      toTeamItem(row, leagueTeamPolicy(league, accessMap.get(row.id)!)),
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
    return toTeamItem(row, leagueTeamPolicy(league, access));
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

  // Unregistering is manager/admin only; a head coach is rejected here.
  if (!actor.isAdmin && !actor.managedOrgIds.has(leagueTeam.team.organizationId))
    throw new AppError(403, messages.error.league.notAuthorized);

  if (league.status === "ACTIVE")
    throw new AppError(409, messages.error.league.cannotUnregisterInActive);

  assertCanRegister(actor, league, leagueTeam.team.organizationId);

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

async function loadLeagueTeam(league: LeagueContext, leagueTeamId: number) {
  const leagueTeam = await prisma.leagueTeam.findFirst({
    where: { id: leagueTeamId, leagueId: league.id, status: "ACTIVE" },
    include: { team: { select: { id: true, organizationId: true } } },
  });
  if (!leagueTeam)
    throw new AppError(404, messages.error.leagueTeam.notFound);
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

async function listMembers(
  leagueId: number,
  leagueTeamId: number,
  query: MembersQuery,
  actor: Actor,
  options: { admin: boolean },
) {
  const league = await loadLeagueContext(leagueId, actor);
  const leagueTeam = await loadLeagueTeam(league, leagueTeamId);
  const where: any = { leagueTeamId, status: "ACTIVE" };
  if (query.role) where.teamSeasonMember = { role: query.role };

  const [items, total] = await prisma.$transaction([
    prisma.leagueTeamMember.findMany({
      where,
      orderBy: memberOrderBy as any,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: memberInclude,
    }),
    prisma.leagueTeamMember.count({ where }),
  ]);

  const rows = items.map((row) =>
    options.admin
      ? toAdminMemberItem(toLeagueTeamMemberRow(row))
      : toPublicMemberItem(toLeagueTeamMemberRow(row)),
  );
  const access = await resolveLeagueTeamAccess(actor, leagueTeam, league);
  const can = leagueTeamPolicy(league, access);
  return { items: rows, total, page: query.page, pageSize: query.pageSize, can };
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
  const league = await loadLeagueContext(leagueId, actor);
  const leagueTeam = await loadLeagueTeam(league, leagueTeamId);
  const access = await resolveLeagueTeamAccess(actor, leagueTeam, league);
  if (access.rosterRole === null)
    throw new AppError(403, messages.error.league.notAuthorized);

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

  const selectedFilter = {
    leagueMemberships: { some: { leagueTeamId, status: "ACTIVE" } },
  };
  const unselectedFilter = {
    leagueMemberships: { none: { leagueTeamId, status: "ACTIVE" } },
  };

  const [total, selectedCount] = await prisma.$transaction([
    prisma.teamSeasonMember.count({ where }),
    prisma.teamSeasonMember.count({ where: { ...where, ...selectedFilter } }),
  ]);

  // Two-phase paging over the virtual list `selected ++ unselected`.
  const skip = (query.page - 1) * query.pageSize;
  const take = query.pageSize;
  const aTake = skip < selectedCount ? Math.min(take, selectedCount - skip) : 0;
  const bSkip = Math.max(0, skip - selectedCount);
  const bTake = take - aTake;

  const include = {
    user: {
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        phone: true,
        birthDate: true,
      },
    },
    leagueMemberships: {
      where: { leagueTeamId, status: "ACTIVE" },
      select: { id: true },
    },
  } as const;

  const [partA, partB] = await Promise.all([
    aTake > 0
      ? prisma.teamSeasonMember.findMany({
          where: { ...where, ...selectedFilter },
          orderBy: teamSeasonMemberOrderBy as any,
          skip,
          take: aTake,
          include,
        })
      : Promise.resolve([]),
    bTake > 0
      ? prisma.teamSeasonMember.findMany({
          where: { ...where, ...unselectedFilter },
          orderBy: teamSeasonMemberOrderBy as any,
          skip: bSkip,
          take: bTake,
          include,
        })
      : Promise.resolve([]),
  ]);
  const members = [...partA, ...partB];

  const playerUserIds = members
    .filter((m) => m.role === "PLAYER")
    .map((m) => m.userId);
  const otherTeams =
    playerUserIds.length > 0
      ? await prisma.leagueTeamMember.findMany({
          where: {
            status: "ACTIVE",
            leagueTeam: { leagueId, status: "ACTIVE", id: { not: leagueTeamId } },
            teamSeasonMember: { role: "PLAYER", userId: { in: playerUserIds } },
          },
          select: { teamSeasonMember: { select: { userId: true } } },
        })
      : [];
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
    const selected = m.leagueMemberships.length > 0;
    const decision = rosterRowPolicy(access, league, {
      teamSeasonMemberId: m.id,
      isHeadCoach: m.isHeadCoach,
    });
    const base = {
      leagueTeamMemberId: selected ? m.leagueMemberships[0].id : null,
      teamSeasonMemberId: m.id,
      userId: m.userId,
      fullName: m.user.fullName,
      avatarUrl: getPublicFileUrl(m.user.avatarUrl, process.env.BASE_URL),
      role: m.role,
      jerseyNumber: m.jerseyNumber,
      isHeadCoach: m.isHeadCoach,
      selected,
      eligible,
      ineligibleReason,
      canToggle: decision.canToggle && (selected || eligible),
      toggleLockReason: decision.lockReason,
    };
    return options.admin
      ? {
          ...base,
          phone: m.user.phone,
          birthDate: gregorianToJalali(m.user.birthDate),
        }
      : base;
  });

  return { items, total, page: query.page, pageSize: query.pageSize };
}

async function addMembers(
  leagueId: number,
  leagueTeamId: number,
  teamSeasonMemberIds: number[],
  actor: Actor,
) {
  const league = await loadLeagueContext(leagueId, actor);
  const leagueTeam = await loadLeagueTeam(league, leagueTeamId);
  const access = await resolveLeagueTeamAccess(actor, leagueTeam, league);
  assertRosterEditable(access, league);

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
    const decision = rosterRowPolicy(access, league, {
      teamSeasonMemberId: row.id,
      isHeadCoach: row.isHeadCoach,
    });
    if (!decision.canToggle)
      throw new AppError(403, messages.error.leagueRoster.headCoachRowManagerOnly);
  }

  const playerUserIds = rows.filter((r) => r.role === "PLAYER").map((r) => r.userId);
  const clashRows =
    playerUserIds.length > 0
      ? await prisma.leagueTeamMember.findMany({
          where: {
            status: "ACTIVE",
            leagueTeam: { leagueId, status: "ACTIVE", id: { not: leagueTeamId } },
            teamSeasonMember: { role: "PLAYER", userId: { in: playerUserIds } },
          },
          select: { teamSeasonMember: { select: { userId: true } } },
        })
      : [];
  const clashUserIds = new Set(clashRows.map((c) => c.teamSeasonMember.userId));

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
      if (clashUserIds.has(row.userId))
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
    return created.map((r) => toPublicMemberItem(toLeagueTeamMemberRow(r)));
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
  const league = await loadLeagueContext(leagueId, actor);
  const leagueTeam = await loadLeagueTeam(league, leagueTeamId);
  const access = await resolveLeagueTeamAccess(actor, leagueTeam, league);
  assertRosterEditable(access, league);

  const row = await prisma.leagueTeamMember.findFirst({
    where: { id: memberId, leagueTeamId, status: "ACTIVE" },
    include: {
      teamSeasonMember: { select: { id: true, role: true, isHeadCoach: true } },
    },
  });
  if (!row) throw new AppError(404, messages.error.leagueRoster.notFound);

  const decision = rosterRowPolicy(access, league, {
    teamSeasonMemberId: row.teamSeasonMember.id,
    isHeadCoach: row.teamSeasonMember.isHeadCoach,
  });
  if (!decision.canToggle)
    throw new AppError(403, messages.error.leagueRoster.headCoachRowManagerOnly);

  if (league.status === "ACTIVE" && row.teamSeasonMember.role === "PLAYER") {
    const remainingPlayers = await prisma.leagueTeamMember.count({
      where: {
        leagueTeamId,
        status: "ACTIVE",
        id: { not: memberId },
        teamSeasonMember: { role: "PLAYER" },
      },
    });
    if (remainingPlayers === 0)
      throw new AppError(409, messages.error.league.teamWithoutPlayers);
  }

  await prisma.leagueTeamMember.update({
    where: { id: memberId },
    data: { status: "DELETED" },
  });
}

export default {
  listLeagueTeams,
  listEligibleTeams,
  registerTeam,
  unregisterTeam,
  listMembers,
  listCandidates,
  addMembers,
  removeMember,
};
