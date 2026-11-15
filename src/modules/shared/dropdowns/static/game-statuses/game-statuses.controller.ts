import type { Request, Response, NextFunction } from "express";
import { messages } from "../../../../../language/message.ts";
import apiResponse from "../../../../../utils/apiResponse.ts";
import gameStatusesService from "./game-statuses.service.ts";

async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const statuses = gameStatusesService.getAllStatuses();
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.gameStatuses.fetched,
      { statuses },
    );
  } catch (error) {
    next(error);
  }
}

export default { getAll };
