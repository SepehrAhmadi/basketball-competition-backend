import type { Request, Response, NextFunction } from "express";
import organizationsService, {
  type CreateOrganizationInput,
  type UpdateOrganizationInput,
} from "./organizations.service.ts";
import { messages } from "../../../language/message.ts";
import apiResponse from "../../../utils/apiResponse.ts";

async function getAll(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = req.validatedQuery as {
      page: number;
      pageSize: number;
    };

    const result = await organizationsService.getAllOrganizations(
      req.userId as number,
      req.roles as string[],
      query,
    );

    return apiResponse.sendResponse(
      res,
      200,
      messages.success.organization.list,
      result,
    );
  } catch (err) {
    next(err);
  }
}

async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const organization = await organizationsService.getOrganizationById(Number(req.params.id));
    return apiResponse.sendResponse(res, 200, messages.success.organization.found, organization);
  } catch (err) {
    next(err);
  }
}

async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as CreateOrganizationInput;
    const organization = await organizationsService.createOrganization(
      input,
      req.userId as number,
      req.file,
    );
    return apiResponse.sendResponse(res, 201, messages.success.organization.created, organization);
  } catch (err) {
    next(err);
  }
}

async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as UpdateOrganizationInput;
    const organization = await organizationsService.updateOrganization(
      Number(req.params.id),
      input,
      req.file,
    );
    return apiResponse.sendResponse(res, 200, messages.success.organization.updated, organization);
  } catch (err) {
    next(err);
  }
}

async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await organizationsService.deleteOrganization(Number(req.params.id));
    return apiResponse.sendResponse(res, 200, messages.success.organization.deleted);
  } catch (err) {
    next(err);
  }
}

export default { getAll, getById, create, update, remove };
