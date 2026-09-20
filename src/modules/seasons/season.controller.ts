import type { Request, Response, NextFunction } from "express";
import { messages } from "../../language/message.ts";
import apiResponse from "../../utils/apiResponse.ts";
import seasonsService from "./season.service.ts";

async function listSeasons(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      page: number;
      pageSize: number;
    };

    const result = await seasonsService.listSeasons(query);
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.season.list,
      result,
    );
  } catch (error) {
    next(error);
  }
}

async function getSeason(req: Request, res: Response, next: NextFunction) {
  try {
    const season = await seasonsService.getSeasonById(
      Number(req.params.seasonId),
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.season.found,
      season,
    );
  } catch (error) {
    next(error);
  }
}

async function createSeason(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as {
      name: string;
      startDate?: string | null;
      endDate?: string | null;
      isActive: boolean;
    };
    const season = await seasonsService.createSeason(input);
    return apiResponse.sendResponse(
      res,
      201,
      messages.success.season.created,
      season,
    );
  } catch (error) {
    next(error);
  }
}

async function updateSeason(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as {
      name?: string;
      startDate?: string | null;
      endDate?: string | null;
      isActive?: boolean;
    };
    const season = await seasonsService.updateSeason(
      Number(req.params.seasonId),
      input,
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.season.updated,
      season,
    );
  } catch (error) {
    next(error);
  }
}

async function deleteSeason(req: Request, res: Response, next: NextFunction) {
  try {
    await seasonsService.deleteSeason(Number(req.params.seasonId));
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.season.deleted,
    );
  } catch (error) {
    next(error);
  }
}

export default { listSeasons, getSeason, createSeason, updateSeason, deleteSeason };
