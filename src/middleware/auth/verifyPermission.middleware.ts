import type { Request, Response, NextFunction } from "express";
import AppError from "../../utils/appError.ts";
import { expandPermissions, type Permission } from "../../shared/permissions.ts";

// Reads straight off the already-decoded token — no DB call, same as verifyRole.
// Passing several permissions means "any of them is enough" (used for shared
// lookup endpoints that more than one admin feature depends on).
// Permissions are expanded here too, so tokens issued before the dependency
// rules existed keep working until they expire.
const verifyPermission = (...permissions: [Permission, ...Permission[]]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.adminLevel === "SUPER_ADMIN") {
      return next();
    }
    const granted = new Set<string>(expandPermissions(req.permissions ?? []));
    if (!permissions.some((p) => granted.has(p))) {
      return next(new AppError(403, `Missing permission: ${permissions.join(" | ")}`));
    }
    next();
  };
};

export default verifyPermission;
