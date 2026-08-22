import type { Request, Response, NextFunction } from "express";
import authService from "./auth.service.ts";
import { messages } from "../../../language/message.ts";
import apiResponse from "../../../utils/apiResponse.ts";

const isProd = process.env.NODE_ENV === "production";

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  maxAge: 24 * 60 * 60 * 1000,
};

async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.register(req.body);
    return apiResponse.sendResponse(res, 201, messages.success.auth.accountCreated, { id: user.id });
  } catch (err) {
    next(err);
  }
}

async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { user, roles, accessToken, refreshToken } = await authService.login(req.body);
    res.cookie("jwt", refreshToken, refreshCookieOptions);
    return apiResponse.sendResponse(res, 200, messages.success.auth.loginSuccessful, {
      accessToken,
      user: { id: user.id, fullName: user.fullName, roles },
    });
  } catch (err) {
    next(err);
  }
}

async function adminLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { user, roles, accessToken, refreshToken } = await authService.adminLogin(req.body);
    res.cookie("jwt", refreshToken, refreshCookieOptions);
    return apiResponse.sendResponse(res, 200, messages.success.auth.loginSuccessful, {
      accessToken,
      user: { id: user.id, fullName: user.fullName, roles },
    });
  } catch (err) {
    next(err);
  }
}

async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { accessToken } = await authService.refreshAccessToken(req.cookies?.jwt);
    return apiResponse.sendResponse(res, 200, messages.success.auth.tokenRefreshed, { accessToken });
  } catch (err) {
    next(err);
  }
}

async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.logout(req.cookies?.jwt);
    res.clearCookie("jwt", refreshCookieOptions);
    return apiResponse.sendResponse(res, 200, messages.success.auth.loggedOut);
  } catch (err) {
    next(err);
  }
}

async function deleteAccount(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.deleteOwnAccount(req.userId as number);
    res.clearCookie("jwt", refreshCookieOptions);
    return apiResponse.sendResponse(res, 200, messages.success.auth.accountDeleted);
  } catch (err) {
    next(err);
  }
}

async function adminCreateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.adminCreateUser(req.body);
    return apiResponse.sendResponse(res, 201, messages.success.auth.userCreated, { id: user.id });
  } catch (err) {
    next(err);
  }
}

async function adminDeleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.adminDeleteUser(Number(req.params.id));
    return apiResponse.sendResponse(res, 200, messages.success.auth.userDeleted);
  } catch (err) {
    next(err);
  }
}

export default {
  register,
  login,
  adminLogin,
  refreshToken,
  logout,
  deleteAccount,
  adminCreateUser,
  adminDeleteUser,
};
