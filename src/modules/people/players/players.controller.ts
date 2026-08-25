import type { Request, Response, NextFunction } from "express";
import playersService from "./players.service.ts";
import { messages } from "../../../language/message.ts";
import apiResponse from "../../../utils/apiResponse.ts";

async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const player = await playersService.getOwnProfile(req.userId as number);
    if (!player)
      return apiResponse.sendResponse(res, 404, messages.error.player.notFound);
    return apiResponse.sendResponse(res, 200, messages.success.player.found, player);
  } catch (err) {
    next(err);
  }
}

async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const player = await playersService.upsertOwnProfile(req.userId as number, req.body);
    return apiResponse.sendResponse(res, 200, messages.success.player.updated, player);
  } catch (err) {
    next(err);
  }
}

export default { getMe, updateMe };
