import type { Request, Response, NextFunction } from "express";
import teamsService from "./teams.service.ts";
import { messages } from "../../language/message.ts";
import apiResponse from "../../utils/apiResponse.ts";
import AppError from "../../utils/appError.ts";

async function listTeams(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      page: number;
      pageSize: number;
      organizationId?: number;
    };

    const result = await teamsService.listTeams(query);
    return apiResponse.sendResponse(res, 200, messages.success.team.list, result);
  } catch (err) {
    next(err);
  }
}

async function getTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const team = await teamsService.getTeamById(Number(req.params.teamId));
    return apiResponse.sendResponse(res, 200, messages.success.team.found, team);
  } catch (err) {
    next(err);
  }
}

async function createTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as {
      organizationId: number;
      name: string;
      foundedYear?: number;
    };
    const team = await teamsService.createTeam(
      input,
      req.userId as number,
      req.roles as string[],
      req.file,
    );
    return apiResponse.sendResponse(res, 201, messages.success.team.created, team);
  } catch (err) {
    next(err);
  }
}

async function updateTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as {
      organizationId?: number;
      name?: string;
      foundedYear?: number;
      removeLogo?: boolean;
    };
    const team = await teamsService.updateTeam(
      Number(req.params.teamId),
      input,
      req.roles as string[],
      req.userId as number,
      req.file,
    );
    return apiResponse.sendResponse(res, 200, messages.success.team.updated, team);
  } catch (err) {
    next(err);
  }
}

async function deleteTeam(req: Request, res: Response, next: NextFunction) {
  try {
    await teamsService.deleteTeam(
      Number(req.params.teamId),
      req.roles as string[],
      req.userId as number,
    );
    return apiResponse.sendResponse(res, 200, messages.success.team.deleted);
  } catch (err) {
    next(err);
  }
}

async function updateLogo(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw new AppError(400, "Logo file is required");
    }
    const team = await teamsService.updateLogo(
      Number(req.params.teamId),
      req.file,
      req.roles as string[],
      req.userId as number,
    );
    return apiResponse.sendResponse(res, 200, messages.success.team.logoUpdated, team);
  } catch (err) {
    next(err);
  }
}

async function getRoster(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      seasonId?: number;
      role?: string;
    };
    const result = await teamsService.getRoster(Number(req.params.teamId), query);
    return apiResponse.sendResponse(res, 200, messages.success.team.rosterList, result);
  } catch (err) {
    next(err);
  }
}

async function addRosterMember(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as {
      userId: number;
      seasonId: number;
      role: "COACH" | "PLAYER";
      jerseyNumber?: number;
      isHeadCoach?: boolean;
    };
    const member = await teamsService.addRosterMember(
      Number(req.params.teamId),
      input,
      req.roles as string[],
      req.userId as number,
    );
    return apiResponse.sendResponse(res, 201, messages.success.team.rosterMemberAdded, member);
  } catch (err) {
    next(err);
  }
}

async function updateRosterMember(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as {
      seasonId: number;
      role?: "COACH" | "PLAYER";
      jerseyNumber?: number | null;
      isHeadCoach?: boolean;
    };
    const memberId = Number(req.params.memberId);
    const member = await teamsService.updateRosterMember(
      Number(req.params.teamId),
      memberId,
      input,
      req.roles as string[],
      req.userId as number,
    );
    return apiResponse.sendResponse(res, 200, messages.success.team.rosterMemberUpdated, member);
  } catch (err) {
    next(err);
  }
}

 async function removeRosterMember(req: Request, res: Response, next: NextFunction) {
  try {
    const { seasonId } = (req.validatedBody ?? req.body) as { seasonId: number };
    const memberId = Number(req.params.memberId);
    await teamsService.removeRosterMember(
      Number(req.params.teamId),
      memberId,
      seasonId,
      req.roles as string[],
      req.userId as number,
    );
    return apiResponse.sendResponse(res, 200, messages.success.team.rosterMemberRemoved);
  } catch (err) {
    next(err);
  }
}

export default {
  listTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  updateLogo,
  getRoster,
  addRosterMember,
  updateRosterMember,
  removeRosterMember,
};
