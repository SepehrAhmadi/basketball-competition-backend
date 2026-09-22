import bcrypt from "bcrypt";
import prisma from "../../../config/db.config.ts";
import { messages } from "../../../language/message.ts";
import AppError from "../../../utils/appError.ts";
import findOrFail from "../../../utils/findOrFail.ts";
import type { Role } from "../../../prisma/generated/prisma/enums.ts";
import type {
  ListUsersQuery,
  UpdateUserByAdminInput,
  UserProfile,
} from "../user/user.types.ts";
import { toUserProfile, applyProfileUpdate } from "../user/user.service.ts";
import { PERMISSION_CATALOG, type Permission } from "../../../shared/permissions.ts";

interface AdminCreateUserInput {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  birthDate?: string | null;
  nationalId?: string;
  roles: Role[];
}

async function adminCreateUser(input: AdminCreateUserInput) {
  const duplicate = await prisma.user.findFirst({
    where: { OR: [{ phone: input.phone }, { email: input.email }] },
  });
  if (duplicate) {
    throw new AppError(409, messages.error.auth.phoneOrEmailInUse);
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  return prisma.user.create({
    data: {
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      passwordHash,
      birthDate: input.birthDate == null ? input.birthDate : undefined,
      nationalId: input.nationalId,
      roles: { create: input.roles.map((role) => ({ role })) },
    },
  });
}

async function adminDeleteUser(targetUserId: number) {
  await findOrFail(prisma.user, targetUserId, messages.error.user.notFound);
  return prisma.user.update({
    where: { id: targetUserId },
    data: { status: "DELETED", refreshToken: null },
  });
}

// Roles whose holders are invisible to a regular ADMIN in user listings.
const ADMIN_LEVEL_ROLES: Role[] = ["ADMIN", "SUPER_ADMIN"];

/**
 * Check whether a target user (by their roles) should be accessible to the
 * requester.  A plain ADMIN may not act on anyone who holds ADMIN or
 * SUPER_ADMIN.  A SUPER_ADMIN may act on everyone.
 */
async function assertTargetAccessible(
  targetUserId: number,
  requesterRoles: Role[],
) {
  if (requesterRoles.includes("SUPER_ADMIN")) return; // full access

  const target = await prisma.userRole.findFirst({
    where: { userId: targetUserId, role: { in: ADMIN_LEVEL_ROLES } },
  });
  if (target) {
    throw new AppError(403, messages.error.auth.forbidden);
  }
}

async function listUsers(
  query: ListUsersQuery,
  requesterRoles: Role[],
) {
  const where: {
    roles?: { some: { role: Role } } | { none: { role: { in: Role[] } } };
    status?: ListUsersQuery["status"];
    OR?: { fullName?: { contains: string }; phone?: { contains: string }; email?: { contains: string } }[];
  } = {};

  // Regular ADMINs must not see ADMIN or SUPER_ADMIN users.
  if (!requesterRoles.includes("SUPER_ADMIN")) {
    where.roles = { none: { role: { in: ADMIN_LEVEL_ROLES } } };
  } else if (query.role) {
    where.roles = { some: { role: query.role } };
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.query) {
    where.OR = [
      { fullName: { contains: query.query } },
      { phone: { contains: query.query } },
      { email: { contains: query.query } },
    ];
  }

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      include: { roles: true },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: users.map((user) => toUserProfile(user)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function getUserById(userId: number): Promise<UserProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: true },
  });
  if (!user) {
    throw new AppError(404, messages.error.user.notFound);
  }
  return toUserProfile(user);
}

async function updateUserByAdmin(
  userId: number,
  data: UpdateUserByAdminInput,
): Promise<UserProfile> {
  return applyProfileUpdate(userId, data);
}

async function resetUserPasswordByAdmin(
  userId: number,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, messages.error.user.notFound);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, refreshToken: null },
  });
}

async function setAdminStatus(targetUserId: number, isAdmin: boolean) {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { roles: true },
  });
  if (!target) throw new AppError(404, messages.error.auth.userNotFound);

  const isSuperAdmin = target.roles.some((r) => r.role === "SUPER_ADMIN");
  if (isSuperAdmin && !isAdmin) {
    throw new AppError(400, messages.error.auth.cannotRevokeAdminFromSuperAdmin);
  }

  const hasAdminRole = target.roles.some((r) => r.role === "ADMIN");

  if (isAdmin && !hasAdminRole) {
    await prisma.userRole.create({ data: { userId: targetUserId, role: "ADMIN" } });
  }

  if (!isAdmin && hasAdminRole) {
    await prisma.userRole.deleteMany({ where: { userId: targetUserId, role: "ADMIN" } });
    // fine-grained permissions are meaningless without ADMIN — clear them too
    await prisma.adminPermission.deleteMany({ where: { userId: targetUserId } });
  }

  return prisma.user.findUnique({ where: { id: targetUserId }, include: { roles: true } });
}

function listPermissionCatalog() {
  return PERMISSION_CATALOG;
}

async function getUserPermissions(targetUserId: number) {
  await findOrFail(prisma.user, targetUserId, messages.error.auth.userNotFound);
  const rows = await prisma.adminPermission.findMany({ where: { userId: targetUserId } });
  return rows.map((r) => r.permission);
}

async function replaceUserPermissions(targetUserId: number, permissions: Permission[]) {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { roles: true },
  });
  if (!target) throw new AppError(404, messages.error.auth.userNotFound);

  const isAdmin = target.roles.some((r) => r.role === "ADMIN");
  if (!isAdmin) {
    throw new AppError(400, messages.error.auth.userNotAdmin);
  }

  const uniquePermissions = [...new Set(permissions)];

  return prisma.$transaction(async (tx) => {
    await tx.adminPermission.deleteMany({ where: { userId: targetUserId } });
    await tx.adminPermission.createMany({
      data: uniquePermissions.map((permission) => ({ userId: targetUserId, permission })),
    });
    return tx.adminPermission.findMany({ where: { userId: targetUserId } });
  });
}

export default {
  adminCreateUser,
  adminDeleteUser,
  assertTargetAccessible,
  listUsers,
  getUserById,
  updateUserByAdmin,
  resetUserPasswordByAdmin,
  setAdminStatus,
  listPermissionCatalog,
  getUserPermissions,
  replaceUserPermissions,
};
