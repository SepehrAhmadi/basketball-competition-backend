import type { Request, Response, NextFunction } from "express";
import AppError from "../../utils/appError.ts";
import type { Role } from "../../prisma/generated/prisma/enums.ts";

const verifyRole = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.roles || req.roles.length === 0) {
      return next(new AppError(401, "No role found"));
    }

    const hasPermission = req.roles.some((role) => allowedRoles.includes(role));

    if (!hasPermission) {
      return next(new AppError(403, "Forbidden"));
    }

    next();
  };
};

export default verifyRole;
