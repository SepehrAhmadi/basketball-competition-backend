import type { Request, Response, NextFunction } from "express";
import coachDegreesService from "./coach-degrees.service.ts";
import { messages } from "../../../language/message.ts";
import apiResponse from "../../../utils/apiResponse.ts";

function getAllDegrees(req: Request, res: Response, next: NextFunction) {
  try {
    const degrees = coachDegreesService.getAllDegrees();
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.coachDegrees.fetched,
      { degrees },
    );
  } catch (err) {
    next(err);
  }
}

export default { getAllDegrees };
