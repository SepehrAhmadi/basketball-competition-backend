import jwt from "jsonwebtoken";
import type { AdminLevel, Role } from "../../prisma/generated/prisma/enums.ts";

export interface AccessTokenPayload {
  userId: number;
  roles: Role[];
  adminLevel: AdminLevel | null;
  permissions: string[];
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string) as AccessTokenPayload;
  // Old tokens issued before the adminLevel split carry no adminLevel
  // field — reject them so the client re-authenticates.
  if (decoded.adminLevel === undefined) {
    throw new Error("Invalid token");
  }
  return decoded;
}

export function getBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.split(" ")[1] ?? null;
}
