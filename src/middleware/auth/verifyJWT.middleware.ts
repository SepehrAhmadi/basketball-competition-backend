import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import AppError from "../../utils/appError.ts";
import type { Role } from "../../prisma/generated/prisma/enums.ts";

interface AccessTokenPayload {
  userId: number;
  roles: Role[];
}

const verifyJWT = (req: Request, res: Response, next: NextFunction) => {
  // Publicly served files (e.g. photos, gallery images) skip auth entirely
  if (req.url.startsWith("/uploads")) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new AppError(401, "Unauthorized"));
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string, (err, decoded) => {
    if (err) {
      return next(new AppError(401, "Invalid token"));
    }

    const payload = decoded as AccessTokenPayload;
    req.userId = payload.userId;
    req.roles = payload.roles;
    next();
  });
};

export default verifyJWT;
