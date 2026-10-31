import prisma from "../../config/db.config.ts";
import AppError from "../../utils/appError.ts";
import { messages } from "../../language/message.ts";
import getPublicFileUrl from "../../utils/getFileUrl.ts";
import { jalaliPatchValue } from "../../utils/date.util.ts";
import { removeFileIfExists, uploadUrlToPath } from "../../utils/files.ts";
import type { Actor } from "../../authz/actor.ts";
import { assertAllowed } from "../../authz/assert.ts";
import { organizationPolicy } from "../organizations/organizations.policy.ts";
import {
  syncHeadCoachToRegistrationLeagues,
  type TransactionClient,
} from "../leagues/lib/league.head-coach-sync.ts";
import { ROSTER_LOCKING_LEAGUE_STATUSES } from "../leagues/lib/league.rules.ts";
import {
  teamPolicy,
  rosterPolicy,
  canManageRosterRole,
  canManageMember,
  type RosterCan,
} from "./teams.policy.ts";
import {
  assertTeamDeletable,
  loadOpenLeagueTeamIds,
} from "./lib/team.locks.ts";
import { withTeamLock } from "./lib/team.access.ts";
import { toPublicTeam } from "./lib/team.mapper.ts";

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

function teamLogoUrlToPath(logoUrl: string | null | undefined): string | null {
  return uploadUrlToPath(logoUrl, TEAM_LOGO_URL_PREFIX, "team-logos");
}

const baseUrl = process.env.BASE_URL;


// Head-coach uniqueness is not a DB constraint, so every path that sets a new
// head coach demotes the previous one through this helper.
async function demoteOtherHeadCoaches(
  tx: TransactionClient,
  teamId: number,
  seasonId: number,
  exceptMemberId?: number,
) {
  await tx.teamSeasonMember.updateMany({
    where: {
      teamId,
      seasonId,
      isHeadCoach: true,
      status: "ACTIVE",
      ...(exceptMemberId !== undefined && { id: { not: exceptMemberId } }),
    },
    data: { isHeadCoach: false },
  });
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

async function isLockedByLeague(memberId: number): Promise<boolean> {
  const row = await prisma.leagueTeamMember.findFirst({
    where: {
      teamSeasonMemberId: memberId,
      status: "ACTIVE",
      leagueTeam: {
        status: "ACTIVE",
        league: { status: { in: [...ROSTER_LOCKING_LEAGUE_STATUSES] } },
      },
    },
    select: { id: true },
  });
  return row !== null;
}

// ─── Authenticated list / detail ─────────────────────────────────────────

async function listTeams(query: {
  page: number;
  pageSize: number;
  organizationId?: number;
}, actor: Actor) {
  const where: any = { status: { not: "DELETED" } };
  if (query.organizationId) {
    where.organizationId = query.organizationId;
  }

  if (!actor.isAdmin) {
    where.OR = [
      { organizationId: { in: [...actor.managedOrgIds] } },
      { id: { in: [...actor.memberTeamIds] } },
    ];
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
    items: items.map((item) => {
      const policy = teamPolicy(actor, { organizationId: item.organizationId, teamId: item.id });

      return {
        ...toPublicTeam(item),
        ...withTeamLock(policy, lockedIds.has(item.id)),
      };
    }),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function getTeamById(teamId: number, actor: Actor) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, status: { not: "DELETED" } },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!team) throw new AppError(404, messages.error.team.notFound);
  const policy = teamPolicy(actor, { organizationId: team.organizationId, teamId });
  assertAllowed(policy.view, messages.error.team.notAuthorized);
  const locked = (await loadOpenLeagueTeamIds([teamId])).has(teamId);
  return { ...toPublicTeam(team), ...withTeamLock(policy, locked) };
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

  const logoUrl = file ? `${TEAM_LOGO_URL_PREFIX}${file.filename}` : undefined;

  try {
    const foundedDate = jalaliPatchValue(data.foundedDate);
    const team = await prisma.team.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        ...(foundedDate !== undefined && { foundedDate }),
        ...(logoUrl !== undefined && { logoUrl }),
      },
    });
    return {
      ...toPublicTeam(team),
      ...withTeamLock(
        teamPolicy(actor, { organizationId: team.organizationId, teamId: team.id }),
        false,
      ),
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
      teamPolicy(actor, { organizationId: team.organizationId, teamId }).edit,
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
        teamPolicy(actor, { organizationId: data.organizationId, teamId }).edit,
        messages.error.team.notAuthorized,
      );
    } catch (err) {
      if (file) removeFileIfExists(file.path);
      throw err;
    }
  }

  const newLogoUrl = file ? `${TEAM_LOGO_URL_PREFIX}${file.filename}` : undefined;
  const shouldRemoveLogo = !file && data.removeLogo === true;

  let updated;
  try {
    const foundedDate = jalaliPatchValue(data.foundedDate);
    const teamData = {
      ...(data.organizationId !== undefined && { organizationId: data.organizationId }),
      ...(data.name !== undefined && { name: data.name }),
      ...(foundedDate !== undefined && { foundedDate }),
      ...(newLogoUrl !== undefined && { logoUrl: newLogoUrl }),
      ...(shouldRemoveLogo && { logoUrl: null }),
    };
    const transferred =
      data.organizationId !== undefined && data.organizationId !== team.organizationId;
    updated = await prisma.$transaction(async (tx) => {
      const result = await tx.team.update({ where: { id: teamId }, data: teamData });
      if (transferred) {
        await tx.teamSeasonMember.updateMany({
          where: { teamId },
          data: { organizationId: result.organizationId },
        });
      }
      return result;
    });
  } catch (err) {
    if (file) removeFileIfExists(file.path);
    throw err;
  }

  if ((file || shouldRemoveLogo) && team.logoUrl) {
    const oldPath = teamLogoUrlToPath(team.logoUrl);
    if (oldPath && oldPath !== file?.path) removeFileIfExists(oldPath);
  }

  const locked = (await loadOpenLeagueTeamIds([teamId])).has(teamId);
  const policy = teamPolicy(actor, { organizationId: updated.organizationId, teamId: updated.id });
  return { ...toPublicTeam(updated), ...withTeamLock(policy, locked) };
}

async function deleteTeam(teamId: number, actor: Actor) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, status: { not: "DELETED" } },
  });
  if (!team) throw new AppError(404, messages.error.team.notFound);

  assertAllowed(
    teamPolicy(actor, { organizationId: team.organizationId, teamId }).delete,
    messages.error.team.notAuthorized,
  );
  await assertTeamDeletable(teamId);

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
      teamPolicy(actor, { organizationId: team.organizationId, teamId }).edit,
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

  const locked = (await loadOpenLeagueTeamIds([teamId])).has(teamId);
  const policy = teamPolicy(actor, { organizationId: updated.organizationId, teamId: updated.id });
  return { ...toPublicTeam(updated), ...withTeamLock(policy, locked) };
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

  assertAllowed(
    teamPolicy(actor, { organizationId: team.organizationId, teamId }).view,
    messages.error.team.notAuthorized,
  );

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

  // Independent lookups run together; results are checked in a fixed order.
  const requiredUserRole = data.role === "COACH" ? "COACH" : "PLAYER";
  const [season, targetUser, hasUserRole] = await Promise.all([
    prisma.season.findFirst({ where: { id: data.seasonId } }),
    prisma.user.findFirst({ where: { id: data.userId, status: "ACTIVE" } }),
    prisma.userRole.findFirst({
      where: { userId: data.userId, role: requiredUserRole },
    }),
  ]);
  if (!season) throw new AppError(404, messages.error.team.seasonNotFound);
  if (!targetUser) throw new AppError(404, messages.error.team.userNotFound);
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

  // Reactivate a soft-deleted row or create a new one; either way a new head
  // coach demotes the previous one in the same transaction.
  try {
    return await prisma.$transaction(async (tx) => {
      if (isHeadCoach) {
        await demoteOtherHeadCoaches(
          tx,
          teamId,
          data.seasonId,
          existingDeletedMember?.id,
        );
      }

      const member = existingDeletedMember
        ? await tx.teamSeasonMember.update({
            where: { id: existingDeletedMember.id },
            data: {
              status: "ACTIVE",
              jerseyNumber,
              isHeadCoach,
              organizationId: team.organizationId,
            },
          })
        : await tx.teamSeasonMember.create({
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
      if (isHeadCoach) {
        await syncHeadCoachToRegistrationLeagues(tx, {
          teamId,
          seasonId: data.seasonId,
          teamSeasonMemberId: member.id,
        });
      }
      return member;
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      const duplicate = await prisma.teamSeasonMember.findFirst({
        where: {
          teamId,
          seasonId: data.seasonId,
          userId: data.userId,
          role: data.role,
          status: "ACTIVE",
        },
      });
      throw new AppError(
        409,
        duplicate
          ? messages.error.team.memberAlreadyExists
          : messages.error.team.jerseyConflict,
      );
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
    effectiveJerseyNumber = effectiveRole === "COACH" ? null : data.jerseyNumber;
  } else if (data.role !== undefined) {
    // Role changed — recalculate jersey
    effectiveJerseyNumber = effectiveRole === "COACH" ? null : member.jerseyNumber;
  }

  const roleChanged = data.role !== undefined && data.role !== member.role;
  const jerseyChanged =
    effectiveJerseyNumber !== undefined &&
    effectiveJerseyNumber !== member.jerseyNumber;
  if ((roleChanged || jerseyChanged) && (await isLockedByLeague(memberId))) {
    throw new AppError(409, messages.error.team.memberInActiveLeague);
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // If becoming head coach (was not before), demote any existing head coach
      if (effectiveIsHeadCoach && !member.isHeadCoach) {
        await demoteOtherHeadCoaches(tx, teamId, data.seasonId, memberId);
      }

      // A role change invalidates the league selection — clear it.
      if (roleChanged) {
        await tx.leagueTeamMember.updateMany({
          where: { teamSeasonMemberId: memberId, status: "ACTIVE" },
          data: { status: "DELETED" },
        });
      }

      const result = await tx.teamSeasonMember.update({
        where: { id: memberId },
        data: {
          ...(data.role !== undefined && { role: data.role }),
          ...(effectiveJerseyNumber !== undefined && { jerseyNumber: effectiveJerseyNumber }),
          isHeadCoach: effectiveIsHeadCoach,
        },
      });

      // New head coach joins the roster of registration-stage leagues.
      if (effectiveIsHeadCoach && !member.isHeadCoach) {
        await syncHeadCoachToRegistrationLeagues(tx, {
          teamId,
          seasonId: data.seasonId,
          teamSeasonMemberId: memberId,
        });
      }
      return result;
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

  if (await isLockedByLeague(memberId)) {
    throw new AppError(409, messages.error.team.memberInActiveLeague);
  }

  await prisma.$transaction([
    prisma.teamSeasonMember.update({
      where: { id: memberId },
      data: { status: "DELETED", jerseyNumber: null, isHeadCoach: false },
    }),
    prisma.leagueTeamMember.updateMany({
      where: { teamSeasonMemberId: memberId, status: "ACTIVE" },
      data: { status: "DELETED" },
    }),
  ]);
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
