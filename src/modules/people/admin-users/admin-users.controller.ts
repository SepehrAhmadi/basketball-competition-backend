import type { Request, Response, NextFunction } from "express";
import adminUsersService from "./admin-users.service.ts";
import { messages } from "../../../language/message.ts";
import apiResponse from "../../../utils/apiResponse.ts";
import type {
  ListUsersQuery,
  UpdateUserByAdminInput,
} from "../user/user.types.ts";

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
    const result = await adminUsersService.listUsers(query);
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

export default {
  createUser,
  listUsers,
  getUserById,
  updateUser,
  deleteUser,
  resetPassword,
};
