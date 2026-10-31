import { Router } from "express";
import validate from "../../../../middleware/validate.ts";
import verifyJWT from "../../../../middleware/auth/verifyJWT.middleware.ts";
import verifyAdminLevel from "../../../../middleware/auth/verifyAdminLevel.middleware.ts";
import verifyPermission from "../../../../middleware/auth/verifyPermission.middleware.ts";
import groupsAdminValidation from "./groups.admin.validation.ts";
import groupsAdminController from "./groups.admin.controller.ts";

const router = Router({ mergeParams: true });

router.use(verifyJWT);
router.use(verifyAdminLevel("ADMIN", "SUPER_ADMIN"));

router.get(
  "/",
  verifyPermission("groups.view"),
  validate(groupsAdminValidation.leagueIdParamSchema, "params"),
  groupsAdminController.list,
);

router.get(
  "/unassigned-teams",
  verifyPermission("groups.view"),
  validate(groupsAdminValidation.leagueIdParamSchema, "params"),
  validate(groupsAdminValidation.unassignedTeamsQuerySchema, "query"),
  groupsAdminController.listUnassigned,
);

router.post(
  "/",
  verifyPermission("groups.create"),
  validate(groupsAdminValidation.createGroupSchema),
  validate(groupsAdminValidation.leagueIdParamSchema, "params"),
  groupsAdminController.create,
);

router.put(
  "/:groupId",
  verifyPermission("groups.update"),
  validate(groupsAdminValidation.groupParamSchema, "params"),
  validate(groupsAdminValidation.updateGroupSchema),
  groupsAdminController.update,
);

router.delete(
  "/:groupId",
  verifyPermission("groups.delete"),
  validate(groupsAdminValidation.groupParamSchema, "params"),
  groupsAdminController.remove,
);

router.put(
  "/:groupId/teams/:leagueTeamId",
  verifyPermission("groups.update"),
  validate(groupsAdminValidation.groupTeamParamSchema, "params"),
  groupsAdminController.assign,
);

router.delete(
  "/:groupId/teams/:leagueTeamId",
  verifyPermission("groups.update"),
  validate(groupsAdminValidation.groupTeamParamSchema, "params"),
  groupsAdminController.unassign,
);

export default router;
