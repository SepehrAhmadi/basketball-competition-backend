import type { Request, Response, NextFunction } from "express";
import teamsAdminService from "./teams.admin.service.ts";
import { messages } from "../../../language/message.ts";
import apiResponse from "../../../utils/apiResponse.ts";

async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      page: number;
      pageSize: number;
      organizationId?: number;
      status?: "ACTIVE" | "INACTIVE" | "DELETED" | "ALL";
      search?: string;
    };
    const result = await teamsAdminService.adminListTeams(query);
    return apiResponse.sendResponse(res, 200, messages.success.team.list, result);
  } catch (err) {
    next(err);
  }
}

async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const team = await teamsAdminService.adminGetTeamById(Number(req.params.teamId));
    return apiResponse.sendResponse(res, 200, messages.success.team.found, team);
  } catch (err) {
    next(err);
  }
}

async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as {
      organizationId: number;
      name: string;
      foundedDate?: string | null;
      status?: "ACTIVE" | "INACTIVE";
    };
    const team = await teamsAdminService.adminCreateTeam(input);
    return apiResponse.sendResponse(res, 201, messages.success.team.created, team);
  } catch (err) {
    next(err);
  }
}

async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as {
      organizationId?: number;
      name?: string;
      foundedDate?: string | null;
      status?: "ACTIVE" | "INACTIVE";
    };
    const team = await teamsAdminService.adminUpdateTeam(Number(req.params.teamId), input);
    return apiResponse.sendResponse(res, 200, messages.success.team.updated, team);
  } catch (err) {
    next(err);
  }
}

async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await teamsAdminService.adminDeleteTeam(Number(req.params.teamId));
    return apiResponse.sendResponse(res, 200, messages.success.team.deleted);
  } catch (err) {
    next(err);
  }
}

async function restore(req: Request, res: Response, next: NextFunction) {
  try {
    const team = await teamsAdminService.adminRestoreTeam(Number(req.params.teamId));
    return apiResponse.sendResponse(res, 200, messages.success.team.restored, team);
  } catch (err) {
    next(err);
  }
}

async function getRoster(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      page: number;
      pageSize: number;
      seasonId: number;
      role?: "COACH" | "PLAYER";
      search?: string;
    };
    const result = await teamsAdminService.adminGetRoster(Number(req.params.teamId), query);
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
    const member = await teamsAdminService.adminAddRosterMember(
      Number(req.params.teamId),
      input,
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
    const member = await teamsAdminService.adminUpdateRosterMember(
      Number(req.params.teamId),
      Number(req.params.memberId),
      input,
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
    await teamsAdminService.adminRemoveRosterMember(
      Number(req.params.teamId),
      Number(req.params.memberId),
      seasonId,
      req.userId as number,
    );
    return apiResponse.sendResponse(res, 200, messages.success.team.rosterMemberRemoved);
  } catch (err) {
    next(err);
  }
}

export default {
  list,
  getById,
  create,
  update,
  remove,
  restore,
  getRoster,
  addRosterMember,
  updateRosterMember,
  removeRosterMember,
};
