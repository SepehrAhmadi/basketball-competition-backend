import prisma from "../../../config/db.config.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";
import getPublicFileUrl from "../../../utils/getFileUrl.ts";
import { jalaliToGregorian, gregorianToJalali } from "../../../utils/date.util.ts";
import teamsService from "../teams.service.ts";

const baseUrl = process.env.BASE_URL;

function withPublicLogoUrl(team: { logoUrl: string | null; foundedDate: Date | null; [key: string]: any }) {
  return {
    ...team,
    logoUrl: getPublicFileUrl(team.logoUrl, baseUrl),
    foundedDate: gregorianToJalali(team.foundedDate),
  };
}

export interface AdminCreateTeamInput {
  organizationId: number;
  name: string;
  foundedDate?: string | null;
  status?: "ACTIVE" | "INACTIVE";
}

export interface AdminUpdateTeamInput {
  organizationId?: number;
  name?: string;
  foundedDate?: string | null;
  status?: "ACTIVE" | "INACTIVE";
}

export interface AdminListTeamsQuery {
  page: number;
  pageSize: number;
  organizationId?: number;
  status?: "ACTIVE" | "INACTIVE" | "DELETED" | "ALL";
  search?: string;
}

export interface AdminRosterQuery {
  page: number;
  pageSize: number;
  seasonId: number;
  role?: "COACH" | "PLAYER";
  search?: string;
}

async function assertActiveOrganization(organizationId: number) {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, status: { not: "DELETED" } },
  });
  if (!organization) {
    throw new AppError(404, messages.error.team.organizationNotFound);
  }
  return organization;
}

async function adminListTeams(query: AdminListTeamsQuery) {
  const where: any = {};

  if (!query.status || query.status === "ALL") {
    if (!query.status) where.status = { not: "DELETED" };
  } else {
    where.status = query.status;
  }

  if (query.organizationId) {
    where.organizationId = query.organizationId;
  }

  if (query.search?.trim()) {
    where.name = { contains: query.search.trim() };
  }

  const [items, total] = await prisma.$transaction([
    prisma.team.findMany({
      where,
      orderBy: { id: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { organization: { select: { id: true, name: true } } },
    }),
    prisma.team.count({ where }),
  ]);

  return {
    items: items.map((item) => withPublicLogoUrl(item)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function adminGetTeamById(teamId: number) {
  const team = await prisma.team.findFirst({
    where: { id: teamId },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!team) throw new AppError(404, messages.error.team.notFound);
  return withPublicLogoUrl(team);
}

async function adminCreateTeam(data: AdminCreateTeamInput) {
  await assertActiveOrganization(data.organizationId);

  const { logoUrl: _ignoredLogoUrl, ...safeData } = data as AdminCreateTeamInput & {
    logoUrl?: unknown;
  };

  const foundedDate =
    safeData.foundedDate != null ? jalaliToGregorian(safeData.foundedDate) : undefined;

  const team = await prisma.team.create({
    data: {
      organizationId: safeData.organizationId,
      name: safeData.name,
      status: safeData.status ?? "ACTIVE",
      ...(foundedDate != null && { foundedDate }),
    },
  });
  return withPublicLogoUrl(team);
}

async function adminUpdateTeam(teamId: number, data: AdminUpdateTeamInput) {
  const team = await prisma.team.findFirst({ where: { id: teamId } });
  if (!team) {
    throw new AppError(404, messages.error.team.notFound);
  }
  if (team.status === "DELETED") {
    throw new AppError(400, messages.error.team.alreadyDeleted);
  }

  if (data.organizationId !== undefined && data.organizationId !== team.organizationId) {
    await assertActiveOrganization(data.organizationId);
  }

  const { logoUrl: _ignoredLogoUrl, ...safeData } = data as AdminUpdateTeamInput & {
    logoUrl?: unknown;
  };

  const foundedDate =
    safeData.foundedDate != null ? jalaliToGregorian(safeData.foundedDate) : undefined;

  const updated = await prisma.team.update({
    where: { id: teamId },
    data: {
      ...(safeData.organizationId !== undefined && { organizationId: safeData.organizationId }),
      ...(safeData.name !== undefined && { name: safeData.name }),
      ...(safeData.status !== undefined && { status: safeData.status }),
      ...(foundedDate != null && { foundedDate }),
    },
  });

  return withPublicLogoUrl(updated);
}

async function adminDeleteTeam(teamId: number) {
  const team = await prisma.team.findFirst({ where: { id: teamId } });
  if (!team) throw new AppError(404, messages.error.team.notFound);
  if (team.status === "DELETED") throw new AppError(400, messages.error.team.alreadyDeleted);
  return prisma.team.update({ where: { id: teamId }, data: { status: "DELETED" } });
}

async function adminRestoreTeam(teamId: number) {
  const team = await prisma.team.findFirst({ where: { id: teamId } });
  if (!team) throw new AppError(404, messages.error.team.notFound);
  if (team.status !== "DELETED") throw new AppError(400, messages.error.team.notDeleted);
  const restored = await prisma.team.update({
    where: { id: teamId },
    data: { status: "ACTIVE" },
  });
  return withPublicLogoUrl(restored);
}

// ACTIVE members only — status is hardcoded, never client-supplied.
async function adminGetRoster(teamId: number, query: AdminRosterQuery) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, status: { not: "DELETED" } },
  });
  if (!team) throw new AppError(404, messages.error.team.notFound);

  const season = await prisma.season.findFirst({ where: { id: query.seasonId } });
  if (!season) throw new AppError(404, messages.error.team.seasonNotFound);

  const where: any = { teamId, seasonId: season.id, status: "ACTIVE" };
  if (query.role) where.role = query.role;

  const search = query.search?.trim();
  if (search) {
    const orConditions: any[] = [
      { user: { fullName: { contains: search } } },
      { user: { phone: { contains: search } } },
    ];
    const asNumber = Number(search);
    if (Number.isInteger(asNumber) && asNumber >= 0 && asNumber <= 99) {
      orConditions.push({ jerseyNumber: asNumber });
    }
    where.OR = orConditions;
  }

  const [items, total] = await prisma.$transaction([
    prisma.teamSeasonMember.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        user: { select: { id: true, fullName: true, phone: true, avatarUrl: true } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.teamSeasonMember.count({ where }),
  ]);

  return {
    team: { id: team.id, name: team.name },
    season: { id: season.id, name: season.name },
    items: items.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      jerseyNumber: m.jerseyNumber,
      isHeadCoach: m.isHeadCoach,
      createdAt: m.createdAt,
      user: {
        ...m.user,
        avatarUrl: getPublicFileUrl(m.user.avatarUrl, baseUrl),
      },
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

// Roster mutations reuse the main service (head-coach demotion + reactivation).
// Permission gating happens at the router; pass an admin level so the
// org-manager self-check is bypassed.
const ADMIN_LEVEL = "ADMIN";

async function adminAddRosterMember(
  teamId: number,
  data: { userId: number; seasonId: number; role: "COACH" | "PLAYER"; jerseyNumber?: number; isHeadCoach?: boolean },
  callerUserId: number,
) {
  return teamsService.addRosterMember(teamId, data, ADMIN_LEVEL, callerUserId);
}

async function adminUpdateRosterMember(
  teamId: number,
  memberId: number,
  data: { seasonId: number; role?: "COACH" | "PLAYER"; jerseyNumber?: number | null; isHeadCoach?: boolean },
  callerUserId: number,
) {
  return teamsService.updateRosterMember(teamId, memberId, data, ADMIN_LEVEL, callerUserId);
}

async function adminRemoveRosterMember(
  teamId: number,
  memberId: number,
  seasonId: number,
  callerUserId: number,
) {
  return teamsService.removeRosterMember(teamId, memberId, seasonId, ADMIN_LEVEL, callerUserId);
}

export default {
  adminListTeams,
  adminGetTeamById,
  adminCreateTeam,
  adminUpdateTeam,
  adminDeleteTeam,
  adminRestoreTeam,
  adminGetRoster,
  adminAddRosterMember,
  adminUpdateRosterMember,
  adminRemoveRosterMember,
};
