import type { Request, Response, NextFunction } from "express";
import adminUsersService from "./admin-users.service.ts";
import { messages } from "../../../language/message.ts";
import apiResponse from "../../../utils/apiResponse.ts";
import type {
  ListUsersQuery,
  UpdateUserByAdminInput,
} from "../user/user.types.ts";
import type { Permission } from "../../../shared/permissions.ts";

async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await adminUsersService.adminCreateUser(
      req.validatedBody ?? req.body,
    );
    return apiResponse.sendResponse(
      res,
      201,
      messages.success.auth.userCreated,
      { id: user.id },
    );
  } catch (err) {
    next(err);
  }
}

async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as ListUsersQuery;
    const result = await adminUsersService.listUsers(query, req.roles ?? []);
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.user.profileFetched,
      result,
    );
  } catch (err) {
    next(err);
  }
}

async function getUserById(req: Request, res: Response, next: NextFunction) {
  try {
    const params = (req.validatedParams ?? req.params) as { id: number };
    await adminUsersService.assertTargetAccessible(params.id, req.roles ?? []);
    const profile = await adminUsersService.getUserById(params.id);
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.user.profileFetched,
      profile,
    );
  } catch (err) {
    next(err);
  }
}

async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const params = (req.validatedParams ?? req.params) as { id: number };
    await adminUsersService.assertTargetAccessible(params.id, req.roles ?? []);
    const input = (req.validatedBody ?? req.body) as UpdateUserByAdminInput;
    const profile = await adminUsersService.updateUserByAdmin(params.id, input);
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.user.profileUpdated,
      profile,
    );
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const params = (req.validatedParams ?? req.params) as { id: number };
    await adminUsersService.assertTargetAccessible(params.id, req.roles ?? []);
    await adminUsersService.adminDeleteUser(Number(req.params.id));
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.auth.userDeleted,
    );
  } catch (err) {
    next(err);
  }
}

async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const params = (req.validatedParams ?? req.params) as { id: number };
    await adminUsersService.assertTargetAccessible(params.id, req.roles ?? []);
    const input = (req.validatedBody ?? req.body) as { newPassword: string };
    await adminUsersService.resetUserPasswordByAdmin(
      params.id,
      input.newPassword,
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.user.passwordChanged,
    );
  } catch (err) {
    next(err);
  }
}

async function setAdminStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const params = (req.validatedParams ?? req.params) as { id: number };
    const input = (req.validatedBody ?? req.body) as { isAdmin: boolean };
    const user = await adminUsersService.setAdminStatus(params.id, input.isAdmin);
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.auth.adminStatusUpdated,
      user,
    );
  } catch (err) {
    next(err);
  }
}

async function listPermissionCatalog(req: Request, res: Response, next: NextFunction) {
  try {
    const catalog = adminUsersService.listPermissionCatalog();
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.auth.permissionCatalogFetched,
      catalog,
    );
  } catch (err) {
    next(err);
  }
}

async function getUserPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const params = (req.validatedParams ?? req.params) as { id: number };
    const permissions = await adminUsersService.getUserPermissions(params.id);
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.auth.permissionsFetched,
      { permissions },
    );
  } catch (err) {
    next(err);
  }
}

async function replaceUserPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const params = (req.validatedParams ?? req.params) as { id: number };
    const input = (req.validatedBody ?? req.body) as { permissions: Permission[] };
    const permissions = await adminUsersService.replaceUserPermissions(
      params.id,
      input.permissions,
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.auth.permissionsUpdated,
      { permissions },
    );
  } catch (err) {
    next(err);
  }
}

export default {
  createUser,
  listUsers,
  getUserById,
  updateUser,
  deleteUser,
  resetPassword,
  setAdminStatus,
  listPermissionCatalog,
  getUserPermissions,
  replaceUserPermissions,
};
