import prisma from "../../../config/db.config.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";
import {
  assertTeamDeletable,
  loadOpenLeagueTeamIds,
} from "../lib/team.locks.ts";
import { buildTeamLock } from "../lib/team.advisories.ts";
import { getTeamLockReason } from "../lib/team.rules.ts";
import { toPublicTeam } from "../lib/team.mapper.ts";
import getPublicFileUrl from "../../../utils/getFileUrl.ts";
import { jalaliPatchValue } from "../../../utils/date.util.ts";

const baseUrl = process.env.BASE_URL;

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

  const lockedIds = await loadOpenLeagueTeamIds(items.map((i) => i.id));
  return {
    items: items.map((item) => ({
      ...toPublicTeam(item),
      lock: buildTeamLock(getTeamLockReason(lockedIds.has(item.id))),
    })),
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
  const locked = (await loadOpenLeagueTeamIds([teamId])).has(teamId);
  return { ...toPublicTeam(team), lock: buildTeamLock(getTeamLockReason(locked)) };
}

async function adminCreateTeam(data: AdminCreateTeamInput) {
  await assertActiveOrganization(data.organizationId);

  const foundedDate = jalaliPatchValue(data.foundedDate);

  const team = await prisma.team.create({
    data: {
      organizationId: data.organizationId,
      name: data.name,
      status: data.status ?? "ACTIVE",
      ...(foundedDate !== undefined && { foundedDate }),
    },
  });
  return toPublicTeam(team);
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

  const foundedDate = jalaliPatchValue(data.foundedDate);
  const transferred =
    data.organizationId !== undefined && data.organizationId !== team.organizationId;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.team.update({
      where: { id: teamId },
      data: {
        ...(data.organizationId !== undefined && { organizationId: data.organizationId }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.status !== undefined && { status: data.status }),
        ...(foundedDate !== undefined && { foundedDate }),
      },
    });
    if (transferred) {
      await tx.teamSeasonMember.updateMany({
        where: { teamId },
        data: { organizationId: result.organizationId },
      });
    }
    return result;
  });

  return toPublicTeam(updated);
}

async function adminDeleteTeam(teamId: number) {
  const team = await prisma.team.findFirst({ where: { id: teamId } });
  if (!team) throw new AppError(404, messages.error.team.notFound);
  if (team.status === "DELETED") throw new AppError(400, messages.error.team.alreadyDeleted);
  await assertTeamDeletable(teamId);
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
  return toPublicTeam(restored);
}

// ACTIVE members only — status is hardcoded, never client-supplied.
async function adminGetRoster(teamId: number, query: AdminRosterQuery) {
  const [team, season] = await Promise.all([
    prisma.team.findFirst({ where: { id: teamId, status: { not: "DELETED" } } }),
    prisma.season.findFirst({ where: { id: query.seasonId } }),
  ]);
  if (!team) throw new AppError(404, messages.error.team.notFound);
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

export default {
  adminListTeams,
  adminGetTeamById,
  adminCreateTeam,
  adminUpdateTeam,
  adminDeleteTeam,
  adminRestoreTeam,
  adminGetRoster,
};
