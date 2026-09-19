import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "../../../config/db.config.ts";
import { messages } from "../../../language/message.ts";
import AppError from "../../../utils/appError.ts";
import type {
  ListUsersQuery,
  UpdateProfileInput,
  UpdateUserByAdminInput,
  UserProfile,
} from "./user.types.ts";
import type { Role } from "../../../prisma/generated/prisma/enums.ts";
import getPublicFileUrl from "../../../utils/getFileUrl.ts";
import { gregorianToJalali, jalaliToGregorian } from "../../../utils/date.util.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// resolves to src/uploads — same root used by createUploader
const UPLOADS_ROOT = path.join(__dirname, "..", "..", "..", "uploads");
const AVATAR_URL_PREFIX = "/uploads/avatars/";

function toUserProfile(user: {
  id: number;
  fullName: string;
  phone: string;
  email: string;
  avatarUrl: string | null;
  birthDate: Date | null;
  nationalId: string | null;
  status: UserProfile["status"];
  createdAt: Date;
  roles: { role: UserProfile["roles"][number] }[];
}): UserProfile {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    avatarUrl: getPublicFileUrl(user.avatarUrl, baseUrl),
    birthDate: gregorianToJalali(user.birthDate),
    nationalId: user.nationalId,
    status: user.status,
    roles: user.roles.map((r) => r.role),
    createdAt: user.createdAt,
  };
}

const baseUrl = process.env.BASE_URL;

function avatarUrlToPath(avatarUrl: string | null): string | null {
  if (!avatarUrl || !avatarUrl.startsWith(AVATAR_URL_PREFIX)) return null;
  return path.join(UPLOADS_ROOT, "avatars", path.basename(avatarUrl));
}

function removeFileIfExists(filePath: string | null) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // filesystem cleanup is best-effort — the DB is already consistent
  }
}

async function getOwnProfile(userId: number): Promise<UserProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: true },
  });
  if (!user) {
    throw new AppError(404, messages.error.user.notFound);
  }
  return toUserProfile(user);
}

async function updateOwnProfile(
  userId: number,
  data: UpdateProfileInput,
): Promise<UserProfile> {
  return applyProfileUpdate(userId, data);
}

type ProfileUpdateData = UpdateProfileInput | UpdateUserByAdminInput;

async function applyProfileUpdate(
  userId: number,
  data: ProfileUpdateData,
): Promise<UserProfile> {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new AppError(404, messages.error.user.notFound);
  }

  // Explicit allow-list — status/passwordHash can never be set here.
  const updateData: {
    fullName?: string;
    phone?: string;
    email?: string;
    birthDate?: Date | null;
    nationalId?: string;
  } = {};
  if (data.fullName !== undefined) updateData.fullName = data.fullName;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.email !== undefined) updateData.email = data.email;
if (data.birthDate !== undefined) {
    updateData.birthDate = data.birthDate === null ? null : jalaliToGregorian(data.birthDate);
  }
  if (data.nationalId !== undefined) updateData.nationalId = data.nationalId;

  const roles = data.roles !== undefined ? [...new Set(data.roles)] : undefined;

  if (Object.keys(updateData).length === 0 && roles === undefined) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });
    return toUserProfile(user!);
  }

  const orConditions: {
    phone?: string;
    email?: string;
    nationalId?: string;
  }[] = [];
  if (updateData.phone) orConditions.push({ phone: updateData.phone });
  if (updateData.email) orConditions.push({ email: updateData.email });
  if (updateData.nationalId)
    orConditions.push({ nationalId: updateData.nationalId });

  if (orConditions.length > 0) {
    const duplicate = await prisma.user.findFirst({
      where: { OR: orConditions, id: { not: userId } },
    });
    if (duplicate) {
      throw new AppError(409, messages.error.auth.phoneOrEmailInUse);
    }
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.user.update({ where: { id: userId }, data: updateData });
      }
      if (roles !== undefined) {
        await syncUserRoles(tx, userId, roles);
      }
      return tx.user.findUnique({
        where: { id: userId },
        include: { roles: true },
      });
    });
    return toUserProfile(user!);
  } catch (err: any) {
    if (err?.code === "P2002") {
      throw new AppError(409, messages.error.auth.phoneOrEmailInUse);
    }
    throw err;
  }
}

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function syncUserRoles(
  tx: TransactionClient,
  userId: number,
  roles: Role[],
): Promise<void> {
  const current = await tx.userRole.findMany({
    where: { userId },
    select: { role: true },
  });
  const currentRoles = new Set(current.map((r) => r.role));
  const nextRoles = new Set(roles);

  const toRemove = [...currentRoles].filter((role) => !nextRoles.has(role));
  const toAdd = [...nextRoles].filter((role) => !currentRoles.has(role));

  if (toRemove.length > 0) {
    await tx.userRole.deleteMany({
      where: { userId, role: { in: toRemove } },
    });
  }
  if (toAdd.length > 0) {
    await tx.userRole.createMany({
      data: toAdd.map((role) => ({ userId, role })),
    });
  }
}

async function updateUserByAdmin(
  userId: number,
  data: UpdateUserByAdminInput,
): Promise<UserProfile> {
  return applyProfileUpdate(userId, data);
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

async function uploadOwnAvatar(
  userId: number,
  file: Express.Multer.File,
): Promise<{ avatarUrl: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    removeFileIfExists(file.path);
    throw new AppError(404, messages.error.user.notFound);
  }

  const oldPath = avatarUrlToPath(user.avatarUrl);
  const avatarUrl = `${AVATAR_URL_PREFIX}${file.filename}`;

  try {
    await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
  } catch (err) {
    removeFileIfExists(file.path);
    throw err;
  }

  if (oldPath && oldPath !== file.path) {
    removeFileIfExists(oldPath);
  }

  return { avatarUrl: getPublicFileUrl(avatarUrl, baseUrl) as string };
}

async function removeOwnAvatar(userId: number): Promise<{ avatarUrl: null }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, messages.error.user.notFound);
  }
  if (!user.avatarUrl) {
    throw new AppError(404, messages.error.user.avatarNotFound);
  }

  const filePath = avatarUrlToPath(user.avatarUrl);
  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: null },
  });
  removeFileIfExists(filePath);

  return { avatarUrl: null };
}

async function changeOwnPassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, messages.error.user.notFound);
  }

  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) {
    throw new AppError(400, messages.error.user.currentPasswordIncorrect);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, refreshToken: null },
  });
}

async function deleteOwnAccount(userId: number): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, messages.error.user.notFound);
  }
  await prisma.user.update({
    where: { id: userId },
    data: { status: "DELETED", refreshToken: null },
  });
}

interface SearchUsersQuery {
  page: number;
  pageSize: number;
  role?: string;
  query?: string;
}

async function searchUsers(searchQuery: SearchUsersQuery) {
  const where: any = { status: "ACTIVE" };

  if (searchQuery.role) {
    where.roles = { some: { role: searchQuery.role as any } };
  }

  if (searchQuery.query) {
    where.OR = [
      { fullName: { contains: searchQuery.query } },
      { phone: { contains: searchQuery.query } },
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: { id: true, fullName: true, phone: true, avatarUrl: true },
      orderBy: { fullName: "asc" },
      skip: (searchQuery.page - 1) * searchQuery.pageSize,
      take: searchQuery.pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      avatarUrl: getPublicFileUrl(item.avatarUrl, baseUrl),
    })),
    total,
    page: searchQuery.page,
    pageSize: searchQuery.pageSize,
  };
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
  getOwnProfile,
  updateOwnProfile,
  uploadOwnAvatar,
  removeOwnAvatar,
  changeOwnPassword,
  deleteOwnAccount,
  searchUsers,
  getUserById,
  listUsers,
  updateUserByAdmin,
  resetUserPasswordByAdmin,
};
