import { Router } from "express";
import validate from "../../../middleware/validate.ts";
import verifyJWT from "../../../middleware/auth/verifyJWT.middleware.ts";
import verifyAdminLevel from "../../../middleware/auth/verifyAdminLevel.middleware.ts";
import verifyPermission from "../../../middleware/auth/verifyPermission.middleware.ts";
import leagueTeamsAdminValidation from "../leagues.validation.ts";
import leagueTeamsAdminController from "./league-teams.admin.controller.ts";

const router = Router({ mergeParams: true });

router.use(verifyJWT);
router.use(verifyAdminLevel("ADMIN", "SUPER_ADMIN"));

router.get(
  "/",
  verifyPermission("league-teams.view"),
  validate(leagueTeamsAdminValidation.leagueTeamsQuerySchema, "query"),
  leagueTeamsAdminController.list,
);

router.post(
  "/",
  verifyPermission("league-teams.create"),
  validate(leagueTeamsAdminValidation.registerTeamSchema),
  leagueTeamsAdminController.register,
);

router.delete(
  "/:leagueTeamId",
  verifyPermission("league-teams.delete"),
  validate(leagueTeamsAdminValidation.leagueTeamParamSchema, "params"),
  leagueTeamsAdminController.unregister,
);

router.get(
  "/:leagueTeamId/members/candidates",
  verifyPermission("league-roster.view"),
  validate(leagueTeamsAdminValidation.leagueTeamParamSchema, "params"),
  validate(leagueTeamsAdminValidation.candidatesQuerySchema, "query"),
  leagueTeamsAdminController.listCandidates,
);

router.get(
  "/:leagueTeamId/members",
  verifyPermission("league-roster.view"),
  validate(leagueTeamsAdminValidation.leagueTeamParamSchema, "params"),
  validate(leagueTeamsAdminValidation.membersQuerySchema, "query"),
  leagueTeamsAdminController.listMembers,
);

router.post(
  "/:leagueTeamId/members",
  verifyPermission("league-roster.create"),
  validate(leagueTeamsAdminValidation.leagueTeamParamSchema, "params"),
  validate(leagueTeamsAdminValidation.addMembersSchema),
  leagueTeamsAdminController.addMembers,
);

router.delete(
  "/:leagueTeamId/members/:memberId",
  verifyPermission("league-roster.delete"),
  validate(leagueTeamsAdminValidation.leagueMemberParamSchema, "params"),
  leagueTeamsAdminController.removeMember,
);

export const eligibleTeamsRouter = Router({ mergeParams: true });

eligibleTeamsRouter.use(verifyJWT);
eligibleTeamsRouter.use(verifyAdminLevel("ADMIN", "SUPER_ADMIN"));

eligibleTeamsRouter.get(
  "/",
  verifyPermission("league-teams.create"),
  validate(leagueTeamsAdminValidation.leagueIdParamSchema, "params"),
  validate(leagueTeamsAdminValidation.eligibleTeamsQuerySchema, "query"),
  leagueTeamsAdminController.listEligible,
);

export default router;

