import { Router } from "express";
import validate from "../../../../middleware/validate.ts";
import verifyJWT from "../../../../middleware/auth/verifyJWT.middleware.ts";
import verifyAdminLevel from "../../../../middleware/auth/verifyAdminLevel.middleware.ts";
import verifyPermission from "../../../../middleware/auth/verifyPermission.middleware.ts";
import ageCategoriesAdminValidation from "./age-categories.admin.validation.ts";
import ageCategoriesAdminController from "./age-categories.admin.controller.ts";

const router = Router();

// All admin age-category routes require authentication + admin level.
router.use(verifyJWT);
router.use(verifyAdminLevel("ADMIN", "SUPER_ADMIN"));

router.get(
  "/",
  verifyPermission("age-categories.view"),
  validate(ageCategoriesAdminValidation.ageCategoryListQuerySchema, "query"),
  ageCategoriesAdminController.list,
);

router.get(
  "/:ageCategoryId",
  verifyPermission("age-categories.view"),
  validate(ageCategoriesAdminValidation.ageCategoryIdParamSchema, "params"),
  ageCategoriesAdminController.getById,
);

router.post(
  "/",
  verifyPermission("age-categories.create"),
  validate(ageCategoriesAdminValidation.createAgeCategorySchema),
  ageCategoriesAdminController.create,
);

router.put(
  "/:ageCategoryId",
  verifyPermission("age-categories.update"),
  validate(ageCategoriesAdminValidation.ageCategoryIdParamSchema, "params"),
  validate(ageCategoriesAdminValidation.updateAgeCategorySchema),
  ageCategoriesAdminController.update,
);

router.delete(
  "/:ageCategoryId",
  verifyPermission("age-categories.delete"),
  validate(ageCategoriesAdminValidation.ageCategoryIdParamSchema, "params"),
  ageCategoriesAdminController.remove,
);

export default router;
