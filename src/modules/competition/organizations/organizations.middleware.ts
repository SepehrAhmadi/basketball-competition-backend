import type { Request, Response, NextFunction } from "express";
import prisma from "../../../config/db.config.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";

async function verifyOrgAccess(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.roles?.includes("ADMIN")) return next();

    const organizationId = Number(req.params.id);
    const membership = await prisma.organizationManager.findFirst({
      where: { organizationId, userId: req.userId as number },
    });

    if (!membership) {
      throw new AppError(403, messages.error.organization.notAuthorized);
    }
    next();
  } catch (err) {
    next(err);
  }
}

export default verifyOrgAccess;
