import type { Request, Response, NextFunction } from "express";
import seasonsService from "./seasons.service.ts";
import { messages } from "../../../language/message.ts";
import apiResponse from "../../../utils/apiResponse.ts";

async function getAllSeasons(req: Request, res: Response, next: NextFunction) {
  try {
    const seasons = await seasonsService.getAllSeasons();
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.seasons.list,
      { seasons },
    );
  } catch (err) {
    next(err);
  }
}

export default { getAllSeasons };
