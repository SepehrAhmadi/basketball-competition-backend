import type { Request, Response, NextFunction } from "express";
import { messages } from "../../../../language/message.ts";
import apiResponse from "../../../../utils/apiResponse.ts";
import leagueTeamsAdminService from "./league-teams.admin.service.ts";

async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      page: number;
      pageSize: number;
      search?: string;
    };
    const result = await leagueTeamsAdminService.listLeagueTeams(
      Number(req.params.leagueId),
      query,
      req.userId!,
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.leagueTeam.list,
      result,
    );
  } catch (error) {
    next(error);
  }
}

async function listEligible(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      page: number;
      pageSize: number;
      search?: string;
      organizationId?: number;
    };
    const result = await leagueTeamsAdminService.listEligibleTeams(
      Number(req.params.leagueId),
      query,
      req.userId!,
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.leagueTeam.eligibleList,
      result,
    );
  } catch (error) {
    next(error);
  }
}

async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as { teamId: number };
    const result = await leagueTeamsAdminService.registerTeam(
      Number(req.params.leagueId),
      input.teamId,
      req.userId!,
    );
    return apiResponse.sendResponse(
      res,
      201,
      messages.success.leagueTeam.registered,
      result,
    );
  } catch (error) {
    next(error);
  }
}

async function unregister(req: Request, res: Response, next: NextFunction) {
  try {
    await leagueTeamsAdminService.unregisterTeam(
      Number(req.params.leagueId),
      Number(req.params.leagueTeamId),
      req.userId!,
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.leagueTeam.removed,
      null,
    );
  } catch (error) {
    next(error);
  }
}

async function listMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      page: number;
      pageSize: number;
      role?: "COACH" | "PLAYER";
    };
    const result = await leagueTeamsAdminService.listMembers(
      Number(req.params.leagueId),
      Number(req.params.leagueTeamId),
      query,
      req.userId!,
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.leagueRoster.list,
      result,
    );
  } catch (error) {
    next(error);
  }
}

async function listCandidates(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      page: number;
      pageSize: number;
      role?: "COACH" | "PLAYER";
      search?: string;
    };
    const result = await leagueTeamsAdminService.listCandidates(
      Number(req.params.leagueId),
      Number(req.params.leagueTeamId),
      query,
      req.userId!,
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.leagueRoster.candidates,
      result,
    );
  } catch (error) {
    next(error);
  }
}

async function addMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as {
      teamSeasonMemberIds: number[];
    };
    const result = await leagueTeamsAdminService.addMembers(
      Number(req.params.leagueId),
      Number(req.params.leagueTeamId),
      input.teamSeasonMemberIds,
      req.userId!,
    );
    return apiResponse.sendResponse(
      res,
      201,
      messages.success.leagueRoster.added,
      result,
    );
  } catch (error) {
    next(error);
  }
}

async function removeMember(req: Request, res: Response, next: NextFunction) {
  try {
    await leagueTeamsAdminService.removeMember(
      Number(req.params.leagueId),
      Number(req.params.leagueTeamId),
      Number(req.params.memberId),
      req.userId!,
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.leagueRoster.removed,
      null,
    );
  } catch (error) {
    next(error);
  }
}

export default {
  list,
  listEligible,
  register,
  unregister,
  listMembers,
  listCandidates,
  addMembers,
  removeMember,
};

