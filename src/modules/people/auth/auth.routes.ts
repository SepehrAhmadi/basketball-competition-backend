import { Router } from "express";
import validate from "../../../middleware/validate.ts";
import verifyJWT from "../../../middleware/auth/verifyJWT.middleware.ts";
import authValidation from "./auth.validation.ts";
import authController from "./auth.controller.ts";

const router = Router();

router.post(
  "/register",
  validate(authValidation.registerSchema),
  authController.register
);
router.post(
  "/login",
  validate(authValidation.loginSchema),
  authController.login
);
router.post(
  "/admin/login",
  validate(authValidation.loginSchema),
  authController.adminLogin
);
router.post(
  "/refresh-token",
  authController.refreshToken
);
router.post(
  "/logout",
  authController.logout
);
router.delete(
  "/account",
  verifyJWT,
  authController.deleteAccount
);

export default router;
