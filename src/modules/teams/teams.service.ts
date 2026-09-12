import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "../../config/db.config.ts";
import AppError from "../../utils/appError.ts";
import { messages } from "../../language/message.ts";
import getPublicFileUrl from "../../utils/getFileUrl.ts";
import { jalaliToGregorian, gregorianToJalali } from "../../utils/date.util.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// resolves to src/uploads — same root used by createUploader
const UPLOADS_ROOT = path.join(__dirname, "..", "..", "..", "uploads");
const TEAM_LOGO_URL_PREFIX = "/uploads/team-logos/";

export interface CreateTeamInput {
  organizationId: number;
  name: string;
  foundedDate?: string | null;
  removeLogo?: boolean;
}

export interface UpdateTeamInput {
  organizationId?: number;
  name?: string;
  foundedDate?: string | null;
  removeLogo?: boolean;
}

// Never delete arbitrary files based on the DB value — only resolve paths
// that live under the team logo directory.
function teamLogoUrlToPath(logoUrl: string | null | undefined): string | null {
  if (!logoUrl || !logoUrl.startsWith(TEAM_LOGO_URL_PREFIX)) return null;
  return path.join(UPLOADS_ROOT, "team-logos", path.basename(logoUrl));
}

const baseUrl = process.env.BASE_URL;
function withPublicLogoUrl(team: { logoUrl: string | null; foundedDate: Date | null; [key: string]: any }) {
  return {
    ...team,
    logoUrl: getPublicFileUrl(team.logoUrl, baseUrl),
    foundedDate: gregorianToJalali(team.foundedDate),
  };
}

function removeFileIfExists(filePath: string | null) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error(`Failed to delete file at ${filePath}:`, err);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function assertOrgManager(orgId: number, userId: number) {
  const membership = await prisma.organizationManager.findFirst({
    where: { organizationId: orgId, userId },
  });
  if (!membership) throw new AppError(403, messages.error.team.notAuthorized);
}

async function getActiveSeasonOrThrow(seasonId?: number) {
  if (seasonId) {
    const season = await prisma.season.findFirst({ where: { id: seasonId } });
    if (!season) throw new AppError(404, messages.error.team.seasonNotFound);
    return season;
  }
  const season = await prisma.season.findFirst({ where: { isActive: true } });
  if (!season) throw new AppError(404, messages.error.team.seasonNotFound);
  return season;
}

// ─── Public list / detail (no auth required) ──────────────────────────────

async function listTeams(query: {
  page: number;
  pageSize: number;
  organizationId?: number;
}) {
  const where: any = { status: { not: "DELETED" } };
  if (query.organizationId) {
    where.organizationId = query.organizationId;
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

async function getTeamById(teamId: number) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, status: { not: "DELETED" } },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!team) throw new AppError(404, messages.error.team.notFound);
  return withPublicLogoUrl(team);
}

// ─── Mutations (auth required) ────────────────────────────────────────────

async function createTeam(
  data: CreateTeamInput,
  userId: number,
  roles: string[],
  file?: Express.Multer.File,
) {
  if (!roles.includes("ADMIN")) {
    await assertOrgManager(data.organizationId, userId);
  }

  const {
    logoUrl: _ignoredLogoUrl,
    removeLogo: _ignoredRemoveLogo,
    ...safeData
  } = data as CreateTeamInput & { logoUrl?: unknown; removeLogo?: unknown };

  // Convert Jalali date string to Gregorian Date before persisting
  const foundedDate = safeData.foundedDate != null
    ? jalaliToGregorian(safeData.foundedDate)
    : undefined;

  const logoUrl = file ? `${TEAM_LOGO_URL_PREFIX}${file.filename}` : undefined;

  try {
    const team = await prisma.team.create({
      data: { ...safeData, ...(foundedDate != null && { foundedDate }), ...(logoUrl != null && { logoUrl }) },
    });
    return withPublicLogoUrl(team);
  } catch (err) {
    if (file) removeFileIfExists(file.path);
    throw err;
  }
}

async function updateTeam(
  teamId: number,
  data: UpdateTeamInput,
  roles: string[],
  userId: number,
  file?: Express.Multer.File,
) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, status: { not: "DELETED" } },
  });
  if (!team) {
    if (file) removeFileIfExists(file.path);
    throw new AppError(404, messages.error.team.notFound);
  }

  if (!roles.includes("ADMIN")) {
    await assertOrgManager(team.organizationId, userId);
  }

  const {
    logoUrl: _ignoredLogoUrl,
    removeLogo,
    ...safeData
  } = data as UpdateTeamInput & { logoUrl?: unknown; removeLogo?: boolean };

  // Convert Jalali date string to Gregorian Date before persisting
  const foundedDate = safeData.foundedDate != null
    ? jalaliToGregorian(safeData.foundedDate)
    : undefined;

  const newLogoUrl = file ? `${TEAM_LOGO_URL_PREFIX}${file.filename}` : undefined;
  const shouldRemoveLogo = !file && removeLogo === true;

  let updated;
  try {
    updated = await prisma.team.update({
      where: { id: teamId },
      data:
        newLogoUrl !== undefined
          ? { ...safeData, ...(foundedDate != null && { foundedDate }), logoUrl: newLogoUrl }
          : shouldRemoveLogo
            ? { ...safeData, ...(foundedDate != null && { foundedDate }), logoUrl: null }
            : { ...safeData, ...(foundedDate != null && { foundedDate }) },
    });
  } catch (err) {
    if (file) removeFileIfExists(file.path);
    throw err;
  }

  if ((file || shouldRemoveLogo) && team.logoUrl) {
    const oldPath = teamLogoUrlToPath(team.logoUrl);
    if (oldPath && oldPath !== file?.path) removeFileIfExists(oldPath);
  }

  return withPublicLogoUrl(updated);
}

async function deleteTeam(teamId: number, roles: string[], userId: number) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, status: { not: "DELETED" } },
  });
  if (!team) throw new AppError(404, messages.error.team.notFound);

  if (!roles.includes("ADMIN")) {
    await assertOrgManager(team.organizationId, userId);
  }

  return prisma.team.update({
    where: { id: teamId },
    data: { status: "DELETED" },
  });
}

async function updateLogo(
  teamId: number,
  file: Express.Multer.File,
  roles: string[],
  userId: number,
) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, status: { not: "DELETED" } },
  });
  if (!team) {
    removeFileIfExists(file.path);
    throw new AppError(404, messages.error.team.notFound);
  }

  if (!roles.includes("ADMIN")) {
    await assertOrgManager(team.organizationId, userId);
  }

  const logoUrl = `${TEAM_LOGO_URL_PREFIX}${file.filename}`;
  let updated;
  try {
    updated = await prisma.team.update({
      where: { id: teamId },
      data: { logoUrl },
    });
  } catch (err) {
    removeFileIfExists(file.path);
    throw err;
  }

  if (team.logoUrl) {
    const oldPath = teamLogoUrlToPath(team.logoUrl);
    if (oldPath && oldPath !== file.path) removeFileIfExists(oldPath);
  }

  return withPublicLogoUrl(updated);
}

// ─── Roster ────────────────────────────────────────────────────────────────

async function getRoster(
  teamId: number,
  query: { seasonId?: number; role?: string; page: number; pageSize: number },
) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, status: { not: "DELETED" } },
  });
  if (!team) throw new AppError(404, messages.error.team.notFound);

  const season = await getActiveSeasonOrThrow(query.seasonId);

  const where: any = {
    teamId,
    seasonId: season.id,
    status: "ACTIVE",
  };
  if (query.role) {
    where.role = query.role;
  }

  const skip = (query.page - 1) * query.pageSize;

  const [items, total] = await prisma.$transaction([
    prisma.teamSeasonMember.findMany({
      where,
      skip,
      take: query.pageSize,
      include: {
        user: {
          select: { id: true, fullName: true, phone: true, avatarUrl: true },
        },
      },
      orderBy: { id: "asc" },
    }),
    prisma.teamSeasonMember.count({ where }),
  ]);

  return {
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

async function addRosterMember(
  teamId: number,
  data: {
    userId: number;
    seasonId: number;
    role: "COACH" | "PLAYER";
    jerseyNumber?: number;
    isHeadCoach?: boolean;
  },
  roles: string[],
  callerUserId: number,
) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, status: { not: "DELETED" } },
  });
  if (!team) throw new AppError(404, messages.error.team.notFound);

  // Caller privilege: ADMIN or manager of this team's org
  if (!roles.includes("ADMIN")) {
    await assertOrgManager(team.organizationId, callerUserId);
  }

  // Validate team season exists
  const season = await prisma.season.findFirst({
    where: { id: data.seasonId },
  });
  if (!season) throw new AppError(404, messages.error.team.seasonNotFound);

  // Verify target user exists and is active
  const targetUser = await prisma.user.findFirst({
    where: { id: data.userId, status: "ACTIVE" },
  });
  if (!targetUser) throw new AppError(404, messages.error.team.userNotFound);

  // Check if the target user has the required role
  const requiredUserRole = data.role === "COACH" ? "COACH" : "PLAYER";
  const hasUserRole = await prisma.userRole.findFirst({
    where: { userId: data.userId, role: requiredUserRole },
  });
  if (!hasUserRole) {
    throw new AppError(400, messages.error.team.userMissingRole);
  }

  // COACH can only add PLAYERs
  if (roles.includes("COACH") && !roles.includes("ADMIN") && !roles.includes("ORG_MANAGER")) {
    if (data.role !== "PLAYER") {
      throw new AppError(403, messages.error.team.coachOnlyAddsPlayer);
    }
  }

  // Validate jerseyNumber: only for PLAYERs
  const jerseyNumber = data.role === "PLAYER" ? data.jerseyNumber : null;

  // Validate isHeadCoach: only COACH role can be head coach
  const isHeadCoach = data.role === "COACH" ? (data.isHeadCoach ?? false) : false;
  if (isHeadCoach && data.role !== "COACH") {
    throw new AppError(400, messages.error.team.headCoachRequiredRole);
  }

  // Create the roster member inside a transaction that handles head-coach demotion
  try {
    const member = await prisma.$transaction(async (tx) => {
      // If setting as head coach, demote any existing head coach for this team/season
      if (isHeadCoach) {
        await tx.teamSeasonMember.updateMany({
          where: {
            teamId,
            seasonId: data.seasonId,
            isHeadCoach: true,
            status: "ACTIVE",
          },
          data: { isHeadCoach: false },
        });
      }

      return tx.teamSeasonMember.create({
        data: {
          teamId,
          seasonId: data.seasonId,
          userId: data.userId,
          role: data.role,
          jerseyNumber,
          isHeadCoach,
          status: "ACTIVE",
        },
      });
    });
    return member;
  } catch (err: any) {
    if (err?.code === "P2002") {
      const target = await prisma.teamSeasonMember.findFirst({
        where: { teamId, seasonId: data.seasonId, userId: data.userId, role: data.role },
      });
      if (target) throw new AppError(409, messages.error.team.headCoachConflict);
      throw new AppError(409, messages.error.team.jerseyConflict);
    }
    throw err;
  }
}

async function updateRosterMember(
  teamId: number,
  memberId: number,
  data: {
    seasonId: number;
    role?: "COACH" | "PLAYER";
    jerseyNumber?: number | null;
    isHeadCoach?: boolean;
  },
  roles: string[],
  callerUserId: number,
) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, status: { not: "DELETED" } },
  });
  if (!team) throw new AppError(404, messages.error.team.notFound);

  // Caller privilege: ADMIN or manager of this team's org
  if (!roles.includes("ADMIN")) {
    await assertOrgManager(team.organizationId, callerUserId);
  }

  // Validate team season exists
  const season = await prisma.season.findFirst({
    where: { id: data.seasonId },
  });
  if (!season) throw new AppError(404, messages.error.team.seasonNotFound);

  const member = await prisma.teamSeasonMember.findFirst({
    where: { id: memberId, teamId, seasonId: data.seasonId, status: "ACTIVE" },
  });
  if (!member) throw new AppError(404, messages.error.team.rosterMemberNotFound);

  const effectiveRole = data.role ?? member.role;

  // Validate isHeadCoach: only COACH role can be head coach; force false for PLAYER
  let effectiveIsHeadCoach: boolean;
  if (data.isHeadCoach !== undefined) {
    effectiveIsHeadCoach = data.isHeadCoach;
  } else if (data.role !== undefined) {
    effectiveIsHeadCoach = data.role === "COACH" ? member.isHeadCoach : false;
  } else {
    effectiveIsHeadCoach = member.isHeadCoach;
  }

  if (effectiveIsHeadCoach && effectiveRole !== "COACH") {
    throw new AppError(400, messages.error.team.headCoachRequiredRole);
  }

  // Determine effective jerseyNumber: only for PLAYERs, null for COACHs
  let effectiveJerseyNumber: number | null | undefined;
  if (data.jerseyNumber !== undefined) {
    effectiveJerseyNumber = data.role === "COACH" ? null : data.jerseyNumber;
  } else if (data.role !== undefined) {
    // Role changed — recalculate jersey
    effectiveJerseyNumber = data.role === "COACH" ? null : member.jerseyNumber;
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // If becoming head coach (was not before), demote any existing head coach
      if (effectiveIsHeadCoach && !member.isHeadCoach) {
        await tx.teamSeasonMember.updateMany({
          where: {
            teamId,
            seasonId: data.seasonId,
            isHeadCoach: true,
            status: "ACTIVE",
            id: { not: memberId },
          },
          data: { isHeadCoach: false },
        });
      }

      return tx.teamSeasonMember.update({
        where: { id: memberId },
        data: {
          ...(data.role !== undefined && { role: data.role }),
          ...(effectiveJerseyNumber !== undefined && { jerseyNumber: effectiveJerseyNumber }),
          isHeadCoach: effectiveIsHeadCoach,
        },
      });
    });
    return updated;
  } catch (err: any) {
    if (err?.code === "P2002") {
      throw new AppError(409, messages.error.team.jerseyConflict);
    }
    throw err;
  }
}

async function removeRosterMember(
  teamId: number,
  memberId: number,
  seasonId: number,
  roles: string[],
  callerUserId: number,
) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, status: { not: "DELETED" } },
  });
  if (!team) throw new AppError(404, messages.error.team.notFound);

  if (!roles.includes("ADMIN")) {
    await assertOrgManager(team.organizationId, callerUserId);
  }

  const member = await prisma.teamSeasonMember.findFirst({
    where: { id: memberId, teamId, seasonId, status: "ACTIVE" },
  });
  if (!member) throw new AppError(404, messages.error.team.rosterMemberNotFound);

  // COACH cannot remove themselves if they are the only COACH for that team/season
  if (roles.includes("COACH") && !roles.includes("ADMIN") && !roles.includes("ORG_MANAGER")) {
    if (member.userId === callerUserId) {
      const coachCount = await prisma.teamSeasonMember.count({
        where: { teamId, seasonId, role: "COACH", status: "ACTIVE" },
      });
      if (coachCount <= 1) {
        throw new AppError(400, messages.error.team.cannotRemoveOwnHeadCoach);
      }
    }
  }

  await prisma.teamSeasonMember.update({
    where: { id: memberId },
    data: { status: "DELETED" },
  });
  return member;
}

export default {
  listTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  updateLogo,
  getRoster,
  addRosterMember,
  updateRosterMember,
  removeRosterMember,
};
