import { Router } from "express";
import validate from "../../../../middleware/validate.ts";
import verifyJWT from "../../../../middleware/auth/verifyJWT.middleware.ts";
import verifyAdminLevel from "../../../../middleware/auth/verifyAdminLevel.middleware.ts";
import verifyPermission from "../../../../middleware/auth/verifyPermission.middleware.ts";
import leaguesAdminValidation from "./leagues.admin.validation.ts";
import leaguesAdminController from "./leagues.admin.controller.ts";
import leagueTeamsAdminValidation from "../league-teams/league-teams.admin.validation.ts";
import leagueTeamsAdminController from "../league-teams/league-teams.admin.controller.ts";

const router = Router();

router.use(verifyJWT);
router.use(verifyAdminLevel("ADMIN", "SUPER_ADMIN"));

router.get(
  "/",
  verifyPermission("leagues.view"),
  validate(leaguesAdminValidation.adminLeagueListQuerySchema, "query"),
  leaguesAdminController.list,
);

router.get(
  "/:leagueId/eligible-teams",
  verifyPermission("league-teams.create"),
  validate(leagueTeamsAdminValidation.leagueIdParamSchema, "params"),
  validate(leagueTeamsAdminValidation.eligibleTeamsQuerySchema, "query"),
  leagueTeamsAdminController.listEligible,
);

router.get(
  "/:leagueId",
  verifyPermission("leagues.view"),
  validate(leaguesAdminValidation.leagueIdParamSchema, "params"),
  leaguesAdminController.getById,
);

router.post(
  "/",
  verifyPermission("leagues.create"),
  validate(leaguesAdminValidation.createLeagueSchema),
  leaguesAdminController.create,
);

router.put(
  "/:leagueId",
  verifyPermission("leagues.update"),
  validate(leaguesAdminValidation.leagueIdParamSchema, "params"),
  validate(leaguesAdminValidation.updateLeagueSchema),
  leaguesAdminController.update,
);

router.patch(
  "/:leagueId/status",
  verifyPermission("leagues.update"),
  validate(leaguesAdminValidation.leagueIdParamSchema, "params"),
  validate(leaguesAdminValidation.updateLeagueStatusSchema),
  leaguesAdminController.updateStatus,
);

router.delete(
  "/:leagueId",
  verifyPermission("leagues.delete"),
  validate(leaguesAdminValidation.leagueIdParamSchema, "params"),
  leaguesAdminController.remove,
);

export default router;
