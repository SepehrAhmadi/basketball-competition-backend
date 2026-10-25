import type { Request, Response, NextFunction } from "express";
import { messages } from "../../../../language/message.ts";
import apiResponse from "../../../../utils/apiResponse.ts";
import type { FormatInput } from "../lib/format.rules.ts";
import formatAdminService from "./format.admin.service.ts";

async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const format = await formatAdminService.getFormat(
      Number(req.params.leagueId),
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.leagueFormat.found,
      format,
    );
  } catch (error) {
    next(error);
  }
}

async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as FormatInput;
    const format = await formatAdminService.updateFormat(
      Number(req.params.leagueId),
      input,
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.leagueFormat.updated,
      format,
    );
  } catch (error) {
    next(error);
  }
}

export default { get, update };
