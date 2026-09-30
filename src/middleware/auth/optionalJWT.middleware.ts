import type { Request, Response, NextFunction } from "express";
import { getBearerToken, verifyAccessToken } from "./accessToken.utils.ts";

const optionalJWT = (req: Request, res: Response, next: NextFunction) => {
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    return next();
  }

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    req.roles = payload.roles;
    req.adminLevel = payload.adminLevel;
    req.permissions = payload.permissions;
  } catch (err) {
    // Public routes stay accessible — an invalid token is treated as guest.
  }
  next();
};

export default optionalJWT;
