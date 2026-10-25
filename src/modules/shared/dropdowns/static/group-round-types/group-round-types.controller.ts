import type { Request, Response, NextFunction } from "express";
import { messages } from "../../../../../language/message.ts";
import apiResponse from "../../../../../utils/apiResponse.ts";
import groupRoundTypesService from "./group-round-types.service.ts";

async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const roundTypes = groupRoundTypesService.getAllRoundTypes();
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.groupRoundTypes.fetched,
      { roundTypes },
    );
  } catch (error) {
    next(error);
  }
}

export default { getAll };
