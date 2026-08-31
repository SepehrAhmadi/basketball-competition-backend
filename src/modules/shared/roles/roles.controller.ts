import type { Request, Response, NextFunction } from "express";
import rolesService from "./roles.service.ts";
import { messages } from "../../../language/message.ts";
import apiResponse from "../../../utils/apiResponse.ts";

function getAllRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const roles = rolesService.getAllRoles();
    return apiResponse.sendResponse(res, 200, messages.success.roles.fetched, {
      roles,
    });
  } catch (err) {
    next(err);
  }
}

export default { getAllRoles };
