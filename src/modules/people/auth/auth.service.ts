import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../../../config/db.config.ts";
import { messages } from "../../../language/message.ts";
import AppError from "../../../utils/appError.ts";
import findOrFail from "../../../utils/findOrFail.ts";
import type { Role } from "../../../prisma/generated/prisma/enums.ts";

const SELF_REGISTER_ROLES: Role[] = ["PLAYER", "COACH", "REFEREE"];

function signAccessToken(userId: number, roles: Role[]) {
  return jwt.sign({ userId, roles }, process.env.ACCESS_TOKEN_SECRET as string, {
    expiresIn: "15m",
  });
}

function signRefreshToken(userId: number) {
  return jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET as string, {
    expiresIn: "1d",
  });
}

interface RegisterInput {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  role: Role;
}

async function register(input: RegisterInput) {
  if (!SELF_REGISTER_ROLES.includes(input.role)) {
    throw new AppError(400, messages.error.auth.invalidSelfRegisterRole);
  }

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
      roles: { create: { role: input.role } },
    },
  });
}

interface LoginInput {
  identifier: string;
  password: string;
}

// shared core — both /auth/login and /auth/admin/login call this
async function authenticateUser({ identifier, password }: LoginInput) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ phone: identifier }, { email: identifier }] },
    include: { roles: true },
  });

  if (!user) {
    throw new AppError(401, messages.error.auth.invalidCredentials);
  }

  if (user.status !== "ACTIVE") {
    throw new AppError(403, messages.error.auth.accountNotActive);
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new AppError(401, messages.error.auth.invalidCredentials);
  }

  const roles = user.roles.map((r) => r.role);
  const accessToken = signAccessToken(user.id, roles);
  const refreshToken = signRefreshToken(user.id);

  await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });

  return { user, roles, accessToken, refreshToken };
}

async function login(input: LoginInput) {
  return authenticateUser(input);
}

// admin-panel-only — same credentials check, plus a hard role gate
async function adminLogin(input: LoginInput) {
  const result = await authenticateUser(input);
  if (!result.roles.includes("ADMIN")) {
    throw new AppError(403, messages.error.auth.notAuthorizedAdminPanel);
  }
  return result;
}

async function refreshAccessToken(refreshTokenFromCookie: string | undefined) {
  if (!refreshTokenFromCookie) {
    throw new AppError(401, messages.error.auth.refreshTokenNotFound);
  }

  const user = await prisma.user.findFirst({
    where: { refreshToken: refreshTokenFromCookie },
    include: { roles: true },
  });
  if (!user) {
    throw new AppError(403, messages.error.auth.invalidRefreshToken);
  }

  try {
    const decoded = jwt.verify(
      refreshTokenFromCookie,
      process.env.REFRESH_TOKEN_SECRET as string
    ) as { userId: number };

    if (decoded.userId !== user.id) {
      throw new AppError(403, messages.error.auth.invalidRefreshToken);
    }
  } catch {
    throw new AppError(403, messages.error.auth.invalidRefreshToken);
  }

  const roles = user.roles.map((r) => r.role);
  return { accessToken: signAccessToken(user.id, roles) };
}

async function logout(refreshTokenFromCookie: string | undefined) {
  if (!refreshTokenFromCookie) {
    return { hadSession: false };
  }

  const user = await prisma.user.findFirst({ where: { refreshToken: refreshTokenFromCookie } });
  if (!user) {
    return { hadSession: false };
  }

  await prisma.user.update({ where: { id: user.id }, data: { refreshToken: null } });
  return { hadSession: true };
}

async function deleteOwnAccount(userId: number) {
  await prisma.user.update({
    where: { id: userId },
    data: { status: "DELETED", refreshToken: null },
  });
}

interface AdminCreateUserInput {
  fullName: string;
  phone: string;
  email: string;
  password: string;
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
      roles: { create: input.roles.map((role) => ({ role })) },
    },
  });
}

async function adminDeleteUser(targetUserId: number) {
  await findOrFail(prisma.user, targetUserId, messages.error.auth.userNotFound);
  return prisma.user.update({
    where: { id: targetUserId },
    data: { status: "DELETED", refreshToken: null },
  });
}

export default {
  register,
  login,
  adminLogin,
  refreshAccessToken,
  logout,
  deleteOwnAccount,
  adminCreateUser,
  adminDeleteUser,
};
