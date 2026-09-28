import type { Request, Response, NextFunction } from "express";
import organizationsAdminService from "./organizations.admin.service.ts";
import { messages } from "../../../language/message.ts";
import apiResponse from "../../../utils/apiResponse.ts";

async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.validatedQuery as {
      page: number;
      pageSize: number;
      search?: string;
      status?: "ACTIVE" | "INACTIVE" | "DELETED" | "ALL";
    };
    const result = await organizationsAdminService.adminListOrganizations(query);
    return apiResponse.sendResponse(res, 200, messages.success.organization.list, result);
  } catch (err) {
    next(err);
  }
}

async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const organization = await organizationsAdminService.adminGetOrganizationById(
      Number(req.params.id),
    );
    return apiResponse.sendResponse(res, 200, messages.success.organization.found, organization);
  } catch (err) {
    next(err);
  }
}

async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as {
      name: string;
      description?: string;
      city?: string;
      phone?: string;
      email?: string;
      managerId: number;
      status?: "ACTIVE" | "INACTIVE";
    };
    const organization = await organizationsAdminService.adminCreateOrganization(input);
    return apiResponse.sendResponse(res, 201, messages.success.organization.created, organization);
  } catch (err) {
    next(err);
  }
}

async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as {
      name?: string;
      description?: string;
      city?: string;
      phone?: string;
      email?: string;
      managerId?: number;
      status?: "ACTIVE" | "INACTIVE";
    };
    const organization = await organizationsAdminService.adminUpdateOrganization(
      Number(req.params.id),
      input,
    );
    return apiResponse.sendResponse(res, 200, messages.success.organization.updated, organization);
  } catch (err) {
    next(err);
  }
}

async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await organizationsAdminService.adminDeleteOrganization(Number(req.params.id));
    return apiResponse.sendResponse(res, 200, messages.success.organization.deleted);
  } catch (err) {
    next(err);
  }
}

async function restore(req: Request, res: Response, next: NextFunction) {
  try {
    const organization = await organizationsAdminService.adminRestoreOrganization(
      Number(req.params.id),
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.organization.restored,
      organization,
    );
  } catch (err) {
    next(err);
  }
}

export default { list, getById, create, update, remove, restore };
