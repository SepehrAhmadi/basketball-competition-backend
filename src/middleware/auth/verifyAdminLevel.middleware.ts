import type { Request, Response, NextFunction } from "express";
import AppError from "../../utils/appError.ts";
import type { AdminLevel } from "../../prisma/generated/prisma/enums.ts";

const verifyAdminLevel = (...allowedLevels: AdminLevel[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.adminLevel) {
      return next(new AppError(403, "Forbidden"));
    }
    if (!allowedLevels.includes(req.adminLevel)) {
      return next(new AppError(403, "Forbidden"));
    }
    next();
  };
};

export default verifyAdminLevel;
