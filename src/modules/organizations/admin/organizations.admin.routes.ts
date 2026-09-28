import { Router } from "express";
import validate from "../../../middleware/validate.ts";
import verifyJWT from "../../../middleware/auth/verifyJWT.middleware.ts";
import verifyAdminLevel from "../../../middleware/auth/verifyAdminLevel.middleware.ts";
import verifyPermission from "../../../middleware/auth/verifyPermission.middleware.ts";
import { idParamSchema } from "../../../shared/schemas.validation.ts";
import organizationsAdminValidation from "./organizations.admin.validation.ts";
import organizationsAdminController from "./organizations.admin.controller.ts";

const router = Router();

// All admin organization routes require authentication + admin level.
// JSON bodies only — logos are managed by the organization manager, not admin.
router.use(verifyJWT);
router.use(verifyAdminLevel("ADMIN", "SUPER_ADMIN"));

router.get(
  "/",
  verifyPermission("organizations.view"),
  validate(organizationsAdminValidation.adminOrganizationListQuerySchema, "query"),
  organizationsAdminController.list,
);

router.get(
  "/:id",
  verifyPermission("organizations.view"),
  validate(idParamSchema, "params"),
  organizationsAdminController.getById,
);

router.post(
  "/",
  verifyPermission("organizations.create"),
  validate(organizationsAdminValidation.adminCreateOrganizationSchema),
  organizationsAdminController.create,
);

router.put(
  "/:id",
  verifyPermission("organizations.update"),
  validate(idParamSchema, "params"),
  validate(organizationsAdminValidation.adminUpdateOrganizationSchema),
  organizationsAdminController.update,
);

router.delete(
  "/:id",
  verifyPermission("organizations.delete"),
  validate(idParamSchema, "params"),
  organizationsAdminController.remove,
);

router.post(
  "/:id/restore",
  verifyPermission("organizations.restore"),
  validate(idParamSchema, "params"),
  organizationsAdminController.restore,
);

export default router;
