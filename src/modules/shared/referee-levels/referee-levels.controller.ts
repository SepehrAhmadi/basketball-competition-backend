import type { Request, Response, NextFunction } from "express";
import refereeLevelsService from "./referee-levels.service.ts";
import { messages } from "../../../language/message.ts";
import apiResponse from "../../../utils/apiResponse.ts";

function getAllLevels(req: Request, res: Response, next: NextFunction) {
  try {
    const levels = refereeLevelsService.getAllLevels();
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.refereeLevels.fetched,
      { levels },
    );
  } catch (err) {
    next(err);
  }
}

export default { getAllLevels };
