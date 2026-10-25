import type { Request, Response, NextFunction } from "express";
import { messages } from "../../../../../language/message.ts";
import apiResponse from "../../../../../utils/apiResponse.ts";
import leagueFormatsService from "./league-formats.service.ts";

async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const formats = leagueFormatsService.getAllFormats();
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.leagueFormats.fetched,
      { formats },
    );
  } catch (error) {
    next(error);
  }
}

export default { getAll };
