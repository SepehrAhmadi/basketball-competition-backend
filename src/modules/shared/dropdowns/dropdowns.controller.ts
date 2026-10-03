import type { Request, Response, NextFunction } from "express";
import dropdownsService from "./dropdowns.service.ts";
import { messages } from "../../../language/message.ts";
import apiResponse from "../../../utils/apiResponse.ts";

function sendDropdown(res: Response, data: unknown) {
  return apiResponse.sendResponse(res, 200, messages.success.dropdown.fetched, data);
}

function getOrganizationStatuses(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendDropdown(res, { items: dropdownsService.getOrganizationStatuses() });
  } catch (err) {
    next(err);
  }
}

function getTeamStatuses(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendDropdown(res, { items: dropdownsService.getTeamStatuses() });
  } catch (err) {
    next(err);
  }
}

function getTeamMemberRoles(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendDropdown(res, { items: dropdownsService.getTeamMemberRoles() });
  } catch (err) {
    next(err);
  }
}

async function getOrganizations(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      search?: string;
      page: number;
      pageSize: number;
    };
    const result = await dropdownsService.getOrganizationsDropdown(query);
    return sendDropdown(res, result);
  } catch (err) {
    next(err);
  }
}

async function getTeams(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      search?: string;
      organizationId?: number;
      page: number;
      pageSize: number;
    };
    const result = await dropdownsService.getTeamsDropdown(query);
    return sendDropdown(res, result);
  } catch (err) {
    next(err);
  }
}

async function getSeasons(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      search?: string;
      page: number;
      pageSize: number;
    };
    const result = await dropdownsService.getSeasonsDropdown(query);
    return sendDropdown(res, result);
  } catch (err) {
    next(err);
  }
}

async function getManagerCandidates(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      search?: string;
      page: number;
      pageSize: number;
    };
    const result = await dropdownsService.getManagerCandidates(query);
    return sendDropdown(res, result);
  } catch (err) {
    next(err);
  }
}

async function getUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      search?: string;
      role?: "ORG_MANAGER" | "COACH" | "PLAYER" | "REFEREE";
      page: number;
      pageSize: number;
    };
    const result = await dropdownsService.getUsersDropdown(query);
    return sendDropdown(res, result);
  } catch (err) {
    next(err);
  }
}

async function getAgeCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      search?: string;
      page: number;
      pageSize: number;
    };
    const result = await dropdownsService.getAgeCategoriesDropdown(query);
    return sendDropdown(res, result);
  } catch (err) {
    next(err);
  }
}

export default {
  getOrganizationStatuses,
  getTeamStatuses,
  getTeamMemberRoles,
  getOrganizations,
  getTeams,
  getSeasons,
  getManagerCandidates,
  getUsers,
  getAgeCategories,
};
