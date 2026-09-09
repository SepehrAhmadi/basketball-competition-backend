import type { Request, Response, NextFunction } from "express";
import prisma from "../../config/db.config.ts";
import AppError from "../../utils/appError.ts";
import { messages } from "../../language/message.ts";

async function verifyTeamAccess(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.roles?.includes("ADMIN")) return next();

    const teamId = Number(req.params.teamId);
    const userId = req.userId as number;

    // ORG_MANAGER: check if the user manages the team's organization.
    if (req.roles?.includes("ORG_MANAGER")) {
      const team = await prisma.team.findFirst({
        where: { id: teamId, status: { not: "DELETED" } },
        select: { organizationId: true },
      });
      if (!team) throw new AppError(404, messages.error.team.notFound);

      const membership = await prisma.organizationManager.findFirst({
        where: { organizationId: team.organizationId, userId },
      });
      if (!membership) throw new AppError(403, messages.error.team.notAuthorized);
      return next();
    }

    // COACH: check if the user is a coach on this team in any active season.
    if (req.roles?.includes("COACH")) {
      const membership = await prisma.teamSeasonMember.findFirst({
        where: { teamId, userId, role: "COACH" },
      });
      if (!membership) throw new AppError(403, messages.error.team.notAuthorized);
      return next();
    }

    throw new AppError(403, messages.error.team.notAuthorized);
  } catch (err) {
    next(err);
  }
}

export default verifyTeamAccess;
