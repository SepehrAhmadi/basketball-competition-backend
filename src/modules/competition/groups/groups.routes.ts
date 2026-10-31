import { Router } from "express";
import validate from "../../../middleware/validate.ts";
import optionalJWT from "../../../middleware/auth/optionalJWT.middleware.ts";
import { optionalActor } from "../../../middleware/auth/attachActor.middleware.ts";
import groupsValidation from "./admin/groups.admin.validation.ts";
import groupsController from "./groups.controller.ts";

const router = Router({ mergeParams: true });

router.get(
  "/",
  optionalJWT,
  optionalActor,
  validate(groupsValidation.leagueIdParamSchema, "params"),
  groupsController.list,
);

export default router;
