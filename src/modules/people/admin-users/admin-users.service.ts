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

async function listUsers(query: ListUsersQuery) {
  const where: {
    roles?: { some: { role: Role } };
    status?: ListUsersQuery["status"];
    OR?: { fullName?: { contains: string }; phone?: { contains: string }; email?: { contains: string } }[];
  } = {};

  if (query.role) {
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

export default {
  adminCreateUser,
  adminDeleteUser,
  listUsers,
  getUserById,
  updateUserByAdmin,
  resetUserPasswordByAdmin,
};
