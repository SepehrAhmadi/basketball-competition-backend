import { Router } from "express";
import validate from "../../../../middleware/validate.ts";
import verifyJWT from "../../../../middleware/auth/verifyJWT.middleware.ts";
import verifyAdminLevel from "../../../../middleware/auth/verifyAdminLevel.middleware.ts";
import verifyPermission from "../../../../middleware/auth/verifyPermission.middleware.ts";
import cutoffsAdminValidation from "./age-category-cutoffs.admin.validation.ts";
import cutoffsAdminController from "./age-category-cutoffs.admin.controller.ts";

const router = Router();

// All admin age-category-cutoff routes require authentication + admin level.
router.use(verifyJWT);
router.use(verifyAdminLevel("ADMIN", "SUPER_ADMIN"));

// Also readable by league managers: the league form needs the cutoff list.
router.get(
  "/",
  verifyPermission("age-categories.view", "leagues.create", "leagues.update"),
  validate(cutoffsAdminValidation.cutoffListQuerySchema, "query"),
  cutoffsAdminController.list,
);

router.get(
  "/:cutoffId",
  verifyPermission("age-categories.view"),
  validate(cutoffsAdminValidation.cutoffIdParamSchema, "params"),
  cutoffsAdminController.getById,
);

router.post(
  "/",
  verifyPermission("age-categories.create"),
  validate(cutoffsAdminValidation.createCutoffSchema),
  cutoffsAdminController.create,
);

router.put(
  "/:cutoffId",
  verifyPermission("age-categories.update"),
  validate(cutoffsAdminValidation.cutoffIdParamSchema, "params"),
  validate(cutoffsAdminValidation.updateCutoffSchema),
  cutoffsAdminController.update,
);

router.delete(
  "/:cutoffId",
  verifyPermission("age-categories.delete"),
  validate(cutoffsAdminValidation.cutoffIdParamSchema, "params"),
  cutoffsAdminController.remove,
);  

export default router;
