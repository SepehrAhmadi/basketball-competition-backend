import type { Request, Response, NextFunction } from "express";
import AppError from "../../utils/appError.ts";
import type { Role } from "../../prisma/generated/prisma/enums.ts";

const verifyRole = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Any admin level bypasses domain-role checks entirely.
    if (req.adminLevel) return next();

    if (!req.roles?.some((role) => allowedRoles.includes(role))) {
      return next(new AppError(403, "Forbidden"));
    }

    next();
  };
};

export default verifyRole;
