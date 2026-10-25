import { Router } from "express";
import validate from "../../../../middleware/validate.ts";
import verifyJWT from "../../../../middleware/auth/verifyJWT.middleware.ts";
import verifyAdminLevel from "../../../../middleware/auth/verifyAdminLevel.middleware.ts";
import verifyPermission from "../../../../middleware/auth/verifyPermission.middleware.ts";
import formatAdminValidation from "./format.admin.validation.ts";
import formatAdminController from "./format.admin.controller.ts";

const router = Router({ mergeParams: true });

router.use(verifyJWT);
router.use(verifyAdminLevel("ADMIN", "SUPER_ADMIN"));

router.get(
  "/",
  verifyPermission("leagues.view"),
  validate(formatAdminValidation.leagueIdParamSchema, "params"),
  formatAdminController.get,
);

router.put(
  "/",
  verifyPermission("leagues.update"),
  validate(formatAdminValidation.leagueIdParamSchema, "params"),
  validate(formatAdminValidation.updateFormatSchema),
  formatAdminController.update,
);

export default router;
