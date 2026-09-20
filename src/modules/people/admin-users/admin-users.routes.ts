import { Router } from "express";
import validate from "../../../middleware/validate.ts";
import verifyJWT from "../../../middleware/auth/verifyJWT.middleware.ts";
import verifyRole from "../../../middleware/auth/verifyRole.middleware.ts";
import { idParamSchema } from "../../../shared/schemas.validation.ts";
import adminUsersValidation from "./admin-users.validation.ts";
import adminUsersController from "./admin-users.controller.ts";

const router = Router();

// All admin user-management routes require authentication + ADMIN role.
router.use(verifyJWT);
router.use(verifyRole("ADMIN"));

router.post(
  "/",
  validate(adminUsersValidation.adminCreateUserSchema),
  adminUsersController.createUser,
);

router.get(
  "/",
  validate(adminUsersValidation.listUsersQuerySchema, "query"),
  adminUsersController.listUsers,
);

router.get(
  "/:id",
  validate(idParamSchema, "params"),
  adminUsersController.getUserById,
);

router.put(
  "/:id",
  validate(idParamSchema, "params"),
  validate(adminUsersValidation.updateUserByAdminSchema),
  adminUsersController.updateUser,
);

router.delete(
  "/:id",
  validate(idParamSchema, "params"),
  adminUsersController.deleteUser,
);

router.patch(
  "/:id/password",
  validate(idParamSchema, "params"),
  validate(adminUsersValidation.adminResetPasswordSchema),
  adminUsersController.resetPassword,
);

export default router;
