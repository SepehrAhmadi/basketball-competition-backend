import { Router } from "express";
import validate from "../../../middleware/validate.ts";
import verifyJWT from "../../../middleware/auth/verifyJWT.middleware.ts";
import verifyRole from "../../../middleware/auth/verifyRole.middleware.ts";
import { idParamSchema } from "../../../shared/schemas.validation.ts";
import userValidation from "./user.validation.ts";
import userController from "./user.controller.ts";

const router = Router();

// Mounted as /admin/users — all routes require authentication + ADMIN role.
router.use(verifyJWT);
router.use(verifyRole("ADMIN"));

router.get(
  "/",
  validate(userValidation.listUsersQuerySchema, "query"),
  userController.getUsers,
);

router.get(
  "/:id",
  validate(idParamSchema, "params"),
  userController.getUserById,
);

router.put(
  "/:id",
  validate(idParamSchema, "params"),
  validate(userValidation.updateUserByAdminSchema),
  userController.updateUserByAdmin,
);

router.patch(
  "/:id/password",
  validate(idParamSchema, "params"),
  validate(userValidation.adminResetPasswordSchema),
  userController.resetPasswordByAdmin,
);

export default router;
