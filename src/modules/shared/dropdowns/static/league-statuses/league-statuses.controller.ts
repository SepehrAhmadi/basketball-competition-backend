import type { Request, Response, NextFunction } from "express";
import { messages } from "../../../../../language/message.ts";
import apiResponse from "../../../../../utils/apiResponse.ts";
import leagueStatusesService from "./league-statuses.service.ts";

async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const statuses = leagueStatusesService.getAllStatuses();
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.leagueStatuses.fetched,
      { statuses },
    );
  } catch (error) {
    next(error);
  }
}

export default { getAll };
