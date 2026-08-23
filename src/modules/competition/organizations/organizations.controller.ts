import type { Request, Response, NextFunction } from "express";
import organizationsService from "./organizations.service.ts";
import { messages } from "../../../language/message.ts";
import apiResponse from "../../../utils/apiResponse.ts";

async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const organizations = await organizationsService.getAllOrganizations(
      req.userId as number,
      req.roles as string[],
    );
    return apiResponse.sendResponse(res, 200, messages.success.organization.list, organizations);
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
    const organization = await organizationsService.createOrganization(req.body, req.userId as number);
    return apiResponse.sendResponse(res, 201, messages.success.organization.created, organization);
  } catch (err) {
    next(err);
  }
}

async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const organization = await organizationsService.updateOrganization(Number(req.params.id), req.body);
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
