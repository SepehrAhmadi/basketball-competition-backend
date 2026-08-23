import type { Request, Response, NextFunction } from "express";
import refereesService from "./referees.service.ts";
import { messages } from "../../../language/message.ts";
import apiResponse from "../../../utils/apiResponse.ts";

async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const referee = await refereesService.getOwnProfile(req.userId as number);
    return apiResponse.sendResponse(res, 200, messages.success.referee.found, referee);
  } catch (err) {
    next(err);
  }
}

async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const referee = await refereesService.upsertOwnProfile(req.userId as number, req.body);
    return apiResponse.sendResponse(res, 200, messages.success.referee.updated, referee);
  } catch (err) {
    next(err);
  }
}

export default { getMe, updateMe };
