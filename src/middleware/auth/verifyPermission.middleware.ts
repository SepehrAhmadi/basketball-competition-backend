import type { Request, Response, NextFunction } from "express";
import AppError from "../../utils/appError.ts";
import type { Permission } from "../../shared/permissions.ts";

// Reads straight off the already-decoded token — no DB call, same as verifyRole.
const verifyPermission = (permission: Permission) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.adminLevel === "SUPER_ADMIN") {
      return next();
    }
    if (!req.permissions?.includes(permission)) {
      return next(new AppError(403, `Missing permission: ${permission}`));
    }
    next();
  };
};

export default verifyPermission;
