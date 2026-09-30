import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "../../config/db.config.ts";
import AppError from "../../utils/appError.ts";
import { messages } from "../../language/message.ts";
import getPublicFileUrl from "../../utils/getFileUrl.ts";
import { jalaliToGregorian, gregorianToJalali } from "../../utils/date.util.ts";
import type { Actor } from "../../authz/actor.ts";
import { assertAllowed } from "../../authz/assert.ts";
import { organizationPolicy } from "../organizations/organizations.policy.ts";
import {
  teamPolicy,
  rosterPolicy,
  canManageRosterRole,
  canManageMember,
  type RosterCan,
} from "./teams.policy.ts";

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

function isOrgManagerOrAdmin(actor: Actor, organizationId: number): boolean {
  return actor.isAdmin || actor.managedOrgIds.has(organizationId);
}

// Preserves the old error-message distinction: a coach who may manage players
// but not coaches gets coachOnlyManagesPlayer when targeting COACH, while a
// caller with no roster power at all gets notAuthorized.
function rosterManageError(can: RosterCan, role: "COACH" | "PLAYER"): string {
  if (role === "COACH" && can.managePlayers) {
    return messages.error.team.coachOnlyManagesPlayer;
  }
  return messages.error.team.notAuthorized;
}

function assertCanManageRoster(
  actor: Actor,
  params: { organizationId: number; teamId: number; seasonId: number },
  role: "COACH" | "PLAYER",
): RosterCan {
  const can = rosterPolicy(actor, params);
  assertAllowed(canManageRosterRole(can, role), rosterManageError(can, role));
  return can;
}

function assertCanManageMember(
  can: RosterCan,
  target: { role: "COACH" | "PLAYER"; isHeadCoach: boolean },
): void {
  // Head-coach rows are manager-only; other rows keep the role-based message
  // distinction (coach targeting COACH vs. no access at all).
  if (target.isHeadCoach) {
    assertAllowed(can.assignHeadCoach, messages.error.team.headCoachAssignForbidden);
    return;
  }
  assertAllowed(canManageMember(can, target), rosterManageError(can, target.role));
}

function assertCanAssignHeadCoach(can: RosterCan): void {
  assertAllowed(can.assignHeadCoach, messages.error.team.headCoachAssignForbidden);
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

async function getTeamById(teamId: number, actor?: Actor) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, status: { not: "DELETED" } },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!team) throw new AppError(404, messages.error.team.notFound);
  const result = withPublicLogoUrl(team);
  if (!actor) return result;
  return { ...result, can: teamPolicy(actor, { organizationId: team.organizationId }) };
}

// ─── Mutations (auth required) ────────────────────────────────────────────

async function createTeam(data: CreateTeamInput, actor: Actor, file?: Express.Multer.File) {
  try {
    assertAllowed(
      organizationPolicy(actor, data.organizationId).createTeam,
      messages.error.team.notAuthorized,
    );
  } catch (err) {
    if (file) removeFileIfExists(file.path);
    throw err;
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
    return {
      ...withPublicLogoUrl(team),
      can: teamPolicy(actor, { organizationId: team.organizationId }),
    };
  } catch (err) {
    if (file) removeFileIfExists(file.path);
    throw err;
  }
}

async function updateTeam(
  teamId: number,
  data: UpdateTeamInput,
  actor: Actor,
  file?: Express.Multer.File,
) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, status: { not: "DELETED" } },
  });
  if (!team) {
    if (file) removeFileIfExists(file.path);
    throw new AppError(404, messages.error.team.notFound);
  }

  try {
    assertAllowed(
      teamPolicy(actor, { organizationId: team.organizationId }).edit,
      messages.error.team.notAuthorized,
    );
  } catch (err) {
    if (file) removeFileIfExists(file.path);
    throw err;
  }
  // Org transfer: the caller must also manage the target organization.
  if (data.organizationId !== undefined && data.organizationId !== team.organizationId) {
    try {
      assertAllowed(
        teamPolicy(actor, { organizationId: data.organizationId }).edit,
        messages.error.team.notAuthorized,
      );
    } catch (err) {
      if (file) removeFileIfExists(file.path);
      throw err;
    }
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

  return {
    ...withPublicLogoUrl(updated),
    can: teamPolicy(actor, { organizationId: updated.organizationId }),
  };
}

async function deleteTeam(teamId: number, actor: Actor) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, status: { not: "DELETED" } },
  });
  if (!team) throw new AppError(404, messages.error.team.notFound);

  assertAllowed(
    teamPolicy(actor, { organizationId: team.organizationId }).delete,
    messages.error.team.notAuthorized,
  );

  return prisma.team.update({
    where: { id: teamId },
    data: { status: "DELETED" },
  });
}

async function updateLogo(teamId: number, file: Express.Multer.File, actor: Actor) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, status: { not: "DELETED" } },
  });
  if (!team) {
    removeFileIfExists(file.path);
    throw new AppError(404, messages.error.team.notFound);
  }

  try {
    assertAllowed(
      teamPolicy(actor, { organizationId: team.organizationId }).edit,
      messages.error.team.notAuthorized,
    );
  } catch (err) {
    removeFileIfExists(file.path);
    throw err;
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

  return {
    ...withPublicLogoUrl(updated),
    can: teamPolicy(actor, { organizationId: updated.organizationId }),
  };
}

// ─── Roster ────────────────────────────────────────────────────────────────

async function getRoster(
  teamId: number,
  query: { seasonId?: number; role?: string; page: number; pageSize: number },
  actor: Actor,
) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, status: { not: "DELETED" } },
  });
  if (!team) throw new AppError(404, messages.error.team.notFound);

  const season = await getActiveSeasonOrThrow(query.seasonId);
  const can = rosterPolicy(actor, {
    organizationId: team.organizationId,
    teamId,
    seasonId: season.id,
  });

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
      can: (() => {
        const ok = canManageMember(can, m);
        return { edit: ok, delete: ok };
      })(),
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    can,
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
  actor: Actor,
) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, status: { not: "DELETED" } },
  });
  if (!team) throw new AppError(404, messages.error.team.notFound);

  const addCan = assertCanManageRoster(
    actor,
    { organizationId: team.organizationId, teamId, seasonId: data.seasonId },
    data.role,
  );
  // Only admins/org managers can assign the head coach.
  if (data.isHeadCoach === true) {
    assertCanAssignHeadCoach(addCan);
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

  // Validate jerseyNumber: only for PLAYERs
  const jerseyNumber = data.role === "PLAYER" ? data.jerseyNumber : null;

  // Validate isHeadCoach: only COACH role can be head coach
  const isHeadCoach = data.role === "COACH" ? (data.isHeadCoach ?? false) : false;
  if (isHeadCoach && data.role !== "COACH") {
    throw new AppError(400, messages.error.team.headCoachRequiredRole);
  }

  // Check for a soft-deleted record with the same key — reactivate instead of creating
  const existingDeletedMember = await prisma.teamSeasonMember.findFirst({
    where: {
      teamId,
      seasonId: data.seasonId,
      userId: data.userId,
      role: data.role,
      status: "DELETED",
    },
  });

  if (existingDeletedMember) {
    const reactivated = await prisma.teamSeasonMember.update({
      where: { id: existingDeletedMember.id },
      data: {
        status: "ACTIVE",
        jerseyNumber,
        isHeadCoach,
        organizationId: team.organizationId,
      },
    });
    return reactivated;
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
          organizationId: team.organizationId,
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
  actor: Actor,
) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, status: { not: "DELETED" } },
  });
  if (!team) throw new AppError(404, messages.error.team.notFound);

  // Validate team season exists
  const season = await prisma.season.findFirst({
    where: { id: data.seasonId },
  });
  if (!season) throw new AppError(404, messages.error.team.seasonNotFound);

  const member = await prisma.teamSeasonMember.findFirst({
    where: { id: memberId, teamId, seasonId: data.seasonId, status: "ACTIVE" },
  });
  if (!member) throw new AppError(404, messages.error.team.rosterMemberNotFound);

  const scope = { organizationId: team.organizationId, teamId, seasonId: data.seasonId };
  const updateCan = rosterPolicy(actor, scope);
  // The caller must manage the existing row (head-coach rows are
  // manager-only), and the resulting role when it changes.
  assertCanManageMember(updateCan, member);
  const resultingRole = data.role ?? member.role;
  if (resultingRole !== member.role) {
    assertAllowed(
      canManageRosterRole(updateCan, resultingRole),
      rosterManageError(updateCan, resultingRole),
    );
  }
  // Only admins/org managers can promote a member to head coach.
  // Demotion (isHeadCoach: false on a head-coach row) is already covered by
  // the row check above.
  if (data.isHeadCoach === true && !member.isHeadCoach) {
    assertCanAssignHeadCoach(updateCan);
  }

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

async function removeRosterMember(teamId: number, memberId: number, seasonId: number, actor: Actor) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, status: { not: "DELETED" } },
  });
  if (!team) throw new AppError(404, messages.error.team.notFound);

  const member = await prisma.teamSeasonMember.findFirst({
    where: { id: memberId, teamId, seasonId, status: "ACTIVE" },
  });
  if (!member) throw new AppError(404, messages.error.team.rosterMemberNotFound);

  assertCanManageMember(
    rosterPolicy(actor, { organizationId: team.organizationId, teamId, seasonId }),
    member,
  );

  // Only self-service coaches are restricted from leaving a team with zero coaches;
  // org managers/admins can still force it.
  if (
    !isOrgManagerOrAdmin(actor, team.organizationId) &&
    member.userId === actor.userId &&
    member.role === "COACH"
  ) {
    const coachCount = await prisma.teamSeasonMember.count({
      where: { teamId, seasonId, role: "COACH", status: "ACTIVE" },
    });
    if (coachCount <= 1) {
      throw new AppError(400, messages.error.team.cannotRemoveOwnHeadCoach);
    }
  }

  await prisma.teamSeasonMember.update({
    where: { id: memberId },
    data: { status: "DELETED", jerseyNumber: null, isHeadCoach: false },
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
