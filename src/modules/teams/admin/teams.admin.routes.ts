import { Router } from "express";
import validate from "../../../middleware/validate.ts";
import verifyJWT from "../../../middleware/auth/verifyJWT.middleware.ts";
import verifyAdminLevel from "../../../middleware/auth/verifyAdminLevel.middleware.ts";
import verifyPermission from "../../../middleware/auth/verifyPermission.middleware.ts";
import teamsAdminValidation from "./teams.admin.validation.ts";
import teamsValidation from "../teams.validation.ts";
import teamsAdminController from "./teams.admin.controller.ts";

const router = Router();

// All admin team routes require authentication + admin level.
// JSON bodies only — logos are managed by the organization manager, not admin.
router.use(verifyJWT);
router.use(verifyAdminLevel("ADMIN", "SUPER_ADMIN"));

// ─── Team CRUD ────────────────────────────────────────────────────────────

router.get(
  "/",
  verifyPermission("teams.view"),
  validate(teamsAdminValidation.adminTeamListQuerySchema, "query"),
  teamsAdminController.list,
);

router.get(
  "/:teamId",
  verifyPermission("teams.view"),
  validate(teamsValidation.teamIdParamSchema, "params"),
  teamsAdminController.getById,
);

router.post(
  "/",
  verifyPermission("teams.create"),
  validate(teamsAdminValidation.adminCreateTeamSchema),
  teamsAdminController.create,
);

router.put(
  "/:teamId",
  verifyPermission("teams.update"),
  validate(teamsValidation.teamIdParamSchema, "params"),
  validate(teamsAdminValidation.adminUpdateTeamSchema),
  teamsAdminController.update,
);

router.delete(
  "/:teamId",
  verifyPermission("teams.delete"),
  validate(teamsValidation.teamIdParamSchema, "params"),
  teamsAdminController.remove,
);

router.post(
  "/:teamId/restore",
  verifyPermission("teams.restore"),
  validate(teamsValidation.teamIdParamSchema, "params"),
  teamsAdminController.restore,
);

// ─── Roster (ACTIVE members only) ─────────────────────────────────────────

router.get(
  "/:teamId/roster",
  verifyPermission("roster.view"),
  validate(teamsValidation.teamIdParamSchema, "params"),
  validate(teamsAdminValidation.adminRosterQuerySchema, "query"),
  teamsAdminController.getRoster,
);

router.post(
  "/:teamId/roster",
  verifyPermission("roster.create"),
  validate(teamsValidation.teamIdParamSchema, "params"),
  validate(teamsValidation.addRosterMemberSchema),
  teamsAdminController.addRosterMember,
);

router.put(
  "/:teamId/roster/:memberId",
  verifyPermission("roster.update"),
  validate(teamsValidation.rosterMemberParamSchema, "params"),
  validate(teamsValidation.updateRosterMemberSchema),
  teamsAdminController.updateRosterMember,
);

router.delete(
  "/:teamId/roster/:memberId",
  verifyPermission("roster.delete"),
  validate(teamsValidation.rosterMemberParamSchema, "params"),
  validate(teamsValidation.removeRosterMemberSchema),
  teamsAdminController.removeRosterMember,
);

export default router;
