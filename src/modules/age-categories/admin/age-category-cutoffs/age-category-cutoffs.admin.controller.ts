import type { Request, Response, NextFunction } from "express";
import cutoffsAdminService from "./age-category-cutoffs.admin.service.ts";
import { messages } from "../../../../language/message.ts";
import apiResponse from "../../../../utils/apiResponse.ts";

async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      page: number;
      pageSize: number;
      ageCategoryId?: number;
      seasonId?: number;
    };
    const result = await cutoffsAdminService.listCutoffs(query);
    return apiResponse.sendResponse(res, 200, messages.success.ageCategoryCutoff.list, result);
  } catch (err) {
    next(err);
  }
}

async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const cutoff = await cutoffsAdminService.getCutoffById(Number(req.params.cutoffId));
    return apiResponse.sendResponse(res, 200, messages.success.ageCategoryCutoff.found, cutoff);
  } catch (err) {
    next(err);
  }
}

async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as {
      ageCategoryId: number;
      seasonId: number;
      minBirthDate: string;
    };
    const cutoff = await cutoffsAdminService.createCutoff(input);
    return apiResponse.sendResponse(res, 201, messages.success.ageCategoryCutoff.created, cutoff);
  } catch (err) {
    next(err);
  }
}

async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as { minBirthDate: string };
    const cutoff = await cutoffsAdminService.updateCutoff(Number(req.params.cutoffId), input);
    return apiResponse.sendResponse(res, 200, messages.success.ageCategoryCutoff.updated, cutoff);
  } catch (err) {
    next(err);
  }
}

async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await cutoffsAdminService.deleteCutoff(Number(req.params.cutoffId));
    return apiResponse.sendResponse(res, 200, messages.success.ageCategoryCutoff.deleted);
  } catch (err) {
    next(err);
  }
}

export default { list, getById, create, update, remove };
