import type { Request, Response, NextFunction } from "express";
import { messages } from "../../../../language/message.ts";
import apiResponse from "../../../../utils/apiResponse.ts";
import groupsAdminService from "./groups.admin.service.ts";

async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await groupsAdminService.listGroups(
      Number(req.params.leagueId),
    );
    return apiResponse.sendResponse(res, 200, messages.success.group.list, data);
  } catch (error) {
    next(error);
  }
}

async function listUnassigned(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.validatedQuery as {
      page: number;
      pageSize: number;
      search?: string;
    };
    const data = await groupsAdminService.listUnassignedTeams(
      Number(req.params.leagueId),
      query,
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.group.unassignedList,
      data,
    );
  } catch (error) {
    next(error);
  }
}

async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as {
      name: string;
      qualifiersOverride?: number | null;
    };
    const data = await groupsAdminService.createGroup(
      Number(req.params.leagueId),
      input,
    );
    return apiResponse.sendResponse(
      res,
      201,
      messages.success.group.created,
      data,
    );
  } catch (error) {
    next(error);
  }
}

async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as {
      name?: string;
      qualifiersOverride?: number | null;
    };
    const data = await groupsAdminService.updateGroup(
      Number(req.params.leagueId),
      Number(req.params.groupId),
      input,
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.group.updated,
      data,
    );
  } catch (error) {
    next(error);
  }
}

async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await groupsAdminService.deleteGroup(
      Number(req.params.leagueId),
      Number(req.params.groupId),
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.group.deleted,
      data,
    );
  } catch (error) {
    next(error);
  }
}

async function assign(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await groupsAdminService.assignTeam(
      Number(req.params.leagueId),
      Number(req.params.groupId),
      Number(req.params.leagueTeamId),
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.group.teamAssigned,
      data,
    );
  } catch (error) {
    next(error);
  }
}

async function unassign(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await groupsAdminService.removeTeam(
      Number(req.params.leagueId),
      Number(req.params.groupId),
      Number(req.params.leagueTeamId),
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.group.teamRemoved,
      data,
    );
  } catch (error) {
    next(error);
  }
}

export default { list, listUnassigned, create, update, remove, assign, unassign };
