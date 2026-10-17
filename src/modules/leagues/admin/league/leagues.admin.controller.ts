import type { Request, Response, NextFunction } from "express";
import { messages } from "../../../../language/message.ts";
import apiResponse from "../../../../utils/apiResponse.ts";
import leaguesAdminService from "./leagues.admin.service.ts";

async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      page: number;
      pageSize: number;
      status?: "INACTIVE" | "REGISTRATION" | "ACTIVE" | "FINISHED";
      seasonId?: number;
      ageCategoryId?: number;
      search?: string;
    };
    const result = await leaguesAdminService.listLeagues(query);
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

async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const league = await leaguesAdminService.getLeagueById(
      Number(req.params.leagueId),
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

async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as {
      name: string;
      ageCategoryCutoffId: number;
      startDate?: string | null;
      endDate?: string | null;
      rosterDeadline?: string | null;
      description?: string | null;
    };
    const league = await leaguesAdminService.createLeague(input);
    return apiResponse.sendResponse(
      res,
      201,
      messages.success.league.created,
      league,
    );
  } catch (error) {
    next(error);
  }
}

async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as {
      name?: string;
      ageCategoryCutoffId?: number;
      startDate?: string | null;
      endDate?: string | null;
      rosterDeadline?: string | null;
      description?: string | null;
    };
    const league = await leaguesAdminService.updateLeague(
      Number(req.params.leagueId),
      input,
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.league.updated,
      league,
    );
  } catch (error) {
    next(error);
  }
}

async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as {
      status: "INACTIVE" | "REGISTRATION" | "ACTIVE" | "FINISHED";
    };
    const league = await leaguesAdminService.updateLeagueStatus(
      Number(req.params.leagueId),
      input.status,
      req.adminLevel === "SUPER_ADMIN",
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.league.statusUpdated,
      league,
    );
  } catch (error) {
    next(error);
  }
}

async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await leaguesAdminService.deleteLeague(Number(req.params.leagueId));
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.league.deleted,
      null,
    );
  } catch (error) {
    next(error);
  }
}

export default {
  list,
  getById,
  create,
  update,
  updateStatus,
  remove,
};
