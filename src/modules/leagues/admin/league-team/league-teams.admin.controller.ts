import type { Request, Response, NextFunction } from "express";
import { messages } from "../../../../language/message.ts";
import apiResponse from "../../../../utils/apiResponse.ts";
import { adminActor } from "../../../../authz/actor.ts";
import leagueTeamsService from "../../services/league-teams.service.ts";
import leagueRosterService from "../../services/league-roster.service.ts";

function asAdmin(req: Request) {
  return adminActor(req.userId!);
}

async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      page: number;
      pageSize: number;
      search?: string;
    };
    const result = await leagueTeamsService.listLeagueTeams(
      Number(req.params.leagueId),
      query,
      asAdmin(req),
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
    const result = await leagueTeamsService.listEligibleTeams(
      Number(req.params.leagueId),
      query,
      asAdmin(req),
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
    const result = await leagueTeamsService.registerTeam(
      Number(req.params.leagueId),
      input.teamId,
      asAdmin(req),
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
    await leagueTeamsService.unregisterTeam(
      Number(req.params.leagueId),
      Number(req.params.leagueTeamId),
      asAdmin(req),
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
    const result = await leagueRosterService.listMembers(
      Number(req.params.leagueId),
      Number(req.params.leagueTeamId),
      query,
      asAdmin(req),
      { admin: true },
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
    const result = await leagueRosterService.listCandidates(
      Number(req.params.leagueId),
      Number(req.params.leagueTeamId),
      query,
      asAdmin(req),
      { admin: true },
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
    const result = await leagueRosterService.addMembers(
      Number(req.params.leagueId),
      Number(req.params.leagueTeamId),
      input.teamSeasonMemberIds,
      asAdmin(req),
      { admin: true },
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
    await leagueRosterService.removeMember(
      Number(req.params.leagueId),
      Number(req.params.leagueTeamId),
      Number(req.params.memberId),
      asAdmin(req),
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
