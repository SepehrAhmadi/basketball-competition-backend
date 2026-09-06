import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "../../../config/db.config.ts";
import { messages } from "../../../language/message.ts";
import AppError from "../../../utils/appError.ts";
import type { UpdateProfileInput, UserProfile } from "./user.types.ts";

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
    avatarUrl: getAvatarUrl(user.avatarUrl, baseUrl),
    birthDate: user.birthDate,
    nationalId: user.nationalId,
    status: user.status,
    roles: user.roles.map((r) => r.role),
    createdAt: user.createdAt,
  };
}

const baseUrl = process.env.BASE_URL;
function getAvatarUrl(
  avatarUrl: string | null,
  baseUrl: string,
): string | null {
  if (!avatarUrl) return null;

  return `${baseUrl.replace(/\/$/, "")}/${avatarUrl.replace(/^\/+/, "")}`;
}

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
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new AppError(404, messages.error.user.notFound);
  }

  // Explicit allow-list — roles/status/passwordHash can never be set here.
  const updateData: {
    fullName?: string;
    phone?: string;
    email?: string;
    birthDate?: Date;
    nationalId?: string;
  } = {};
  if (data.fullName !== undefined) updateData.fullName = data.fullName;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.birthDate !== undefined) updateData.birthDate = data.birthDate;
  if (data.nationalId !== undefined) updateData.nationalId = data.nationalId;

  if (Object.keys(updateData).length === 0) {
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
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { roles: true },
    });
    return toUserProfile(user);
  } catch (err: any) {
    if (err?.code === "P2002") {
      throw new AppError(409, messages.error.auth.phoneOrEmailInUse);
    }
    throw err;
  }
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

  return { avatarUrl };
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

export default {
  getOwnProfile,
  updateOwnProfile,
  uploadOwnAvatar,
  removeOwnAvatar,
  changeOwnPassword,
  deleteOwnAccount,
};
