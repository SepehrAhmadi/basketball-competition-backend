import type { Request, Response, NextFunction } from "express";
import ageCategoriesAdminService from "./age-categories.admin.service.ts";
import { messages } from "../../../../language/message.ts";
import apiResponse from "../../../../utils/apiResponse.ts";

async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      page: number;
      pageSize: number;
      search?: string;
    };
    const result = await ageCategoriesAdminService.listAgeCategories(query);
    return apiResponse.sendResponse(res, 200, messages.success.ageCategory.list, result);
  } catch (err) {
    next(err);
  }
}

async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const category = await ageCategoriesAdminService.getAgeCategoryById(
      Number(req.params.ageCategoryId),
    );
    return apiResponse.sendResponse(res, 200, messages.success.ageCategory.found, category);
  } catch (err) {
    next(err);
  }
}

async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as { name: string };
    const category = await ageCategoriesAdminService.createAgeCategory(input);
    return apiResponse.sendResponse(res, 201, messages.success.ageCategory.created, category);
  } catch (err) {
    next(err);
  }
}

async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as { name?: string };
    const category = await ageCategoriesAdminService.updateAgeCategory(
      Number(req.params.ageCategoryId),
      input,
    );
    return apiResponse.sendResponse(res, 200, messages.success.ageCategory.updated, category);
  } catch (err) {
    next(err);
  }
}

async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await ageCategoriesAdminService.deleteAgeCategory(Number(req.params.ageCategoryId));
    return apiResponse.sendResponse(res, 200, messages.success.ageCategory.deleted);
  } catch (err) {
    next(err);
  }
}

export default { list, getById, create, update, remove };
