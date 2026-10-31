import type { Request, Response, NextFunction } from "express";
import { messages } from "../../../language/message.ts";
import apiResponse from "../../../utils/apiResponse.ts";
import groupsService from "./groups.service.ts";

async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await groupsService.listPublicGroups(
      Number(req.params.leagueId),
      req.actor!,
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.group.publicList,
      data,
    );
  } catch (error) {
    next(error);
  }
}

export default { list };
