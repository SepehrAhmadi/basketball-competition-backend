import type { Request, Response, NextFunction } from "express";
import userService from "./user.service.ts";
import { messages } from "../../../language/message.ts";
import apiResponse from "../../../utils/apiResponse.ts";
import AppError from "../../../utils/appError.ts";
import type {
  AdminResetPasswordInput,
  ChangePasswordInput,
  ListUsersQuery,
  UpdateProfileInput,
  UpdateUserByAdminInput,
} from "./user.types.ts";

const isProd = process.env.NODE_ENV === "production";

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  maxAge: 24 * 60 * 60 * 1000,
};

async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await userService.getOwnProfile(
      req.userId as number,
    );
    return apiResponse.sendResponse(res, 200, messages.success.user.profileFetched, profile);
  } catch (err) {
    next(err);
  }
}

async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as UpdateProfileInput;
    const profile = await userService.updateOwnProfile(
      req.userId as number,
      input,
    );
    return apiResponse.sendResponse(res, 200, messages.success.user.profileUpdated, profile);
  } catch (err) {
    next(err);
  }
}

async function uploadAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw new AppError(400, messages.error.user.avatarRequired);
    }
    const result = await userService.uploadOwnAvatar(
      req.userId as number,
      req.file,
    );
    return apiResponse.sendResponse(res, 200, messages.success.user.avatarUploaded, result);
  } catch (err) {
    next(err);
  }
}

async function removeAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    await userService.removeOwnAvatar(req.userId as number);
    return apiResponse.sendResponse(res, 200, messages.success.user.avatarRemoved);
  } catch (err) {
    next(err);
  }
}

async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as ChangePasswordInput;
    await userService.changeOwnPassword(
      req.userId as number,
      input.currentPassword,
      input.newPassword,
    );
    res.clearCookie("jwt", refreshCookieOptions);
    return apiResponse.sendResponse(res, 200, messages.success.user.passwordChanged);
  } catch (err) {
    next(err);
  }
}

async function deleteMe(req: Request, res: Response, next: NextFunction) {
  try {
    await userService.deleteOwnAccount(req.userId as number);
    res.clearCookie("jwt", refreshCookieOptions);
    return apiResponse.sendResponse(res, 200, messages.success.user.accountDeleted);
  } catch (err) {
    next(err);
  }
}

async function searchUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as {
      page: number;
      pageSize: number;
      role?: string;
      query?: string;
    };

    const result = await userService.searchUsers(query);
    return apiResponse.sendResponse(res, 200, "Users found", result);
  } catch (err) {
    next(err);
  }
}

async function getUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as ListUsersQuery;
    const result = await userService.listUsers(query);
    return apiResponse.sendResponse(res, 200, messages.success.user.profileFetched, result);
  } catch (err) {
    next(err);
  }
}

async function getUserById(req: Request, res: Response, next: NextFunction) {
  try {
    const params = (req.validatedParams ?? req.params) as { id: number };
    const profile = await userService.getUserById(params.id);
    return apiResponse.sendResponse(res, 200, messages.success.user.profileFetched, profile);
  } catch (err) {
    next(err);
  }
}

async function updateUserByAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const params = (req.validatedParams ?? req.params) as { id: number };
    const input = (req.validatedBody ?? req.body) as UpdateUserByAdminInput;
    const profile = await userService.updateUserByAdmin(params.id, input);
    return apiResponse.sendResponse(res, 200, messages.success.user.profileUpdated, profile);
  } catch (err) {
    next(err);
  }
}

async function resetPasswordByAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const params = (req.validatedParams ?? req.params) as { id: number };
    const input = (req.validatedBody ?? req.body) as AdminResetPasswordInput;
    await userService.resetUserPasswordByAdmin(params.id, input.newPassword);
    return apiResponse.sendResponse(res, 200, messages.success.user.passwordChanged);
  } catch (err) {
    next(err);
  }
}

export default {
  getMe,
  updateMe,
  uploadAvatar,
  removeAvatar,
  changePassword,
  deleteMe,
  searchUsers,
  getUsers,
  getUserById,
  updateUserByAdmin,
  resetPasswordByAdmin,
};
