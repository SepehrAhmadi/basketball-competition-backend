import { Router } from "express";
import validate from "../../../middleware/validate.ts";
import verifyJWT from "../../../middleware/auth/verifyJWT.middleware.ts";
import verifyRole from "../../../middleware/auth/verifyRole.middleware.ts";
import verifyPermission from "../../../middleware/auth/verifyPermission.middleware.ts";
import { idParamSchema } from "../../../shared/schemas.validation.ts";
import adminUsersValidation from "./admin-users.validation.ts";
import adminUsersController from "./admin-users.controller.ts";

const router = Router();

// All admin user-management routes require authentication + ADMIN role.
router.use(verifyJWT);
router.use(verifyRole("ADMIN"));

router.post(
  "/",
  verifyPermission("users.create"),
  validate(adminUsersValidation.adminCreateUserSchema),
  adminUsersController.createUser,
);

router.get(
  "/",
  verifyPermission("users.view"),
  validate(adminUsersValidation.listUsersQuerySchema, "query"),
  adminUsersController.listUsers,
);

// Must be registered before "/:id" so Express doesn't try to match
// "permissions" as an :id value.
router.get(
  "/permissions",
  verifyRole("SUPER_ADMIN"),
  adminUsersController.listPermissionCatalog,
);

router.get(
  "/:id",
  verifyPermission("users.view"),
  validate(idParamSchema, "params"),
  adminUsersController.getUserById,
);

router.put(
  "/:id",
  verifyPermission("users.update"),
  validate(idParamSchema, "params"),
  validate(adminUsersValidation.updateUserByAdminSchema),
  adminUsersController.updateUser,
);

router.delete(
  "/:id",
  verifyPermission("users.delete"),
  validate(idParamSchema, "params"),
  adminUsersController.deleteUser,
);

router.patch(
  "/:id/password",
  verifyPermission("users.reset_password"),
  validate(idParamSchema, "params"),
  validate(adminUsersValidation.adminResetPasswordSchema),
  adminUsersController.resetPassword,
);

// SUPER_ADMIN-only: granting/revoking ADMIN and managing fine-grained
// permissions must never be reachable by a plain ADMIN.
router.put(
  "/:id/admin-status",
  verifyRole("SUPER_ADMIN"),
  validate(idParamSchema, "params"),
  validate(adminUsersValidation.setAdminStatusSchema),
  adminUsersController.setAdminStatus,
);

router.get(
  "/:id/permissions",
  verifyRole("SUPER_ADMIN"),
  validate(idParamSchema, "params"),
  adminUsersController.getUserPermissions,
);

router.put(
  "/:id/permissions",
  verifyRole("SUPER_ADMIN"),
  validate(idParamSchema, "params"),
  validate(adminUsersValidation.replacePermissionsSchema),
  adminUsersController.replaceUserPermissions,
);

export default router;
