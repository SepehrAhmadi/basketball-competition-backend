import { Router } from "express";
import validate from "../../../middleware/validate.ts";
import verifyJWT from "../../../middleware/auth/verifyJWT.middleware.ts";
import verifyRole from "../../../middleware/auth/verifyRole.middleware.ts";
import schemas from "../../../shared/schemas.validation.ts";
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

// admin-only user management — lives here since it operates on the same User/UserRole models
router.post(
  "/admin/users",
  verifyJWT,
  verifyRole("ADMIN"),
  validate(authValidation.adminCreateUserSchema),
  authController.adminCreateUser
);
router.delete(
  "/admin/users/:id",
  verifyJWT,
  verifyRole("ADMIN"),
  validate(schemas.idParamSchema, "params"),
  authController.adminDeleteUser
);

export default router;
