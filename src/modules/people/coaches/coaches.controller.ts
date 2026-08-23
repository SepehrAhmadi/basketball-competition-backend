import type { Request, Response, NextFunction } from "express";
import coachesService from "./coaches.service.ts";
import { messages } from "../../../language/message.ts";
import apiResponse from "../../../utils/apiResponse.ts";

async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const coach = await coachesService.getOwnProfile(req.userId as number);
    return apiResponse.sendResponse(res, 200, messages.success.coach.found, coach);
  } catch (err) {
    next(err);
  }
}

async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const coach = await coachesService.upsertOwnProfile(req.userId as number, req.body);
    return apiResponse.sendResponse(res, 200, messages.success.coach.updated, coach);
  } catch (err) {
    next(err);
  }
}

export default { getMe, updateMe };
