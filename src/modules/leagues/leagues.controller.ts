import type { Request, Response, NextFunction } from "express";
import { messages } from "../../language/message.ts";
import apiResponse from "../../utils/apiResponse.ts";
import leaguesService from "./services/leagues.service.ts";
import leagueTeamsService from "./services/league-teams.service.ts";
import leagueRosterService from "./services/league-roster.service.ts";

async function listPublic(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      page: number;
      pageSize: number;
      status?: "REGISTRATION" | "ACTIVE" | "FINISHED";
      seasonId?: number;
      ageCategoryId?: number;
      search?: string;
    };
    const result = await leaguesService.listPublicLeagues(query, req.actor!);
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.league.list,
      result,
    );
  } catch (error) {
    next(error);
  }
}

async function getPublic(req: Request, res: Response, next: NextFunction) {
  try {
    const league = await leaguesService.getPublicLeague(
      Number(req.params.leagueId),
      req.actor!,
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.league.found,
      league,
    );
  } catch (error) {
    next(error);
  }
}

async function listMine(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      page: number;
      pageSize: number;
      status?: "REGISTRATION" | "ACTIVE" | "FINISHED";
    };
    const result = await leaguesService.listMyLeagues(
      req.userId!,
      query,
      req.actor!,
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.league.myList,
      result,
    );
  } catch (error) {
    next(error);
  }
}

async function listMyTeams(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await leaguesService.listMyTeams(
      Number(req.params.leagueId),
      req.actor!,
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.leagueTeam.myList,
      result,
    );
  } catch (error) {
    next(error);
  }
}

async function getTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await leaguesService.getLeagueTeamDetail(
      Number(req.params.leagueId),
      Number(req.params.leagueTeamId),
      req.actor!,
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.leagueTeam.found,
      result,
    );
  } catch (error) {
    next(error);
  }
}

async function listTeams(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      page: number;
      pageSize: number;
      search?: string;
    };
    const result = await leagueTeamsService.listLeagueTeams(
      Number(req.params.leagueId),
      query,
      req.actor!,
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
      req.actor!,
      { admin: false },
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
      req.actor!,
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
      req.actor!,
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
      req.actor!,
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
      req.actor!,
      { admin: false },
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
      req.actor!,
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
      req.actor!,
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
  listPublic,
  getPublic,
  listMine,
  listMyTeams,
  getTeam,
  listTeams,
  listMembers,
  listEligible,
  register,
  unregister,
  listCandidates,
  addMembers,
  removeMember,
};
