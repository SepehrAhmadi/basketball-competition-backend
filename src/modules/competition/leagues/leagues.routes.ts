import { Router } from "express";
import validate from "../../../middleware/validate.ts";
import verifyJWT from "../../../middleware/auth/verifyJWT.middleware.ts";
import optionalJWT from "../../../middleware/auth/optionalJWT.middleware.ts";
import {
  attachActor,
  optionalActor,
} from "../../../middleware/auth/attachActor.middleware.ts";
import leaguesValidation from "./leagues.validation.ts";
import leaguesController from "./leagues.controller.ts";

const router = Router();

router.get(
  "/me",
  verifyJWT,
  attachActor,
  validate(leaguesValidation.myLeaguesQuerySchema, "query"),
  leaguesController.listMine,
);

router.get(
  "/",
  optionalJWT,
  optionalActor,
  validate(leaguesValidation.publicLeagueListQuerySchema, "query"),
  leaguesController.listPublic,
);

router.get(
  "/:leagueId",
  optionalJWT,
  optionalActor,
  validate(leaguesValidation.leagueIdParamSchema, "params"),
  leaguesController.getPublic,
);

router.get(
  "/:leagueId/teams",
  optionalJWT,
  optionalActor,
  validate(leaguesValidation.leagueIdParamSchema, "params"),
  validate(leaguesValidation.leagueTeamsQuerySchema, "query"),
  leaguesController.listTeams,
);

router.get(
  "/:leagueId/teams/:leagueTeamId/members",
  optionalJWT,
  optionalActor,
  validate(leaguesValidation.leagueTeamParamSchema, "params"),
  validate(leaguesValidation.membersQuerySchema, "query"),
  leaguesController.listMembers,
);

router.get(
  "/:leagueId/eligible-teams",
  verifyJWT,
  attachActor,
  validate(leaguesValidation.leagueIdParamSchema, "params"),
  validate(leaguesValidation.eligibleTeamsQuerySchema, "query"),
  leaguesController.listEligible,
);

router.post(
  "/:leagueId/teams",
  verifyJWT,
  attachActor,
  validate(leaguesValidation.leagueIdParamSchema, "params"),
  validate(leaguesValidation.registerTeamSchema),
  leaguesController.register,
);

router.delete(
  "/:leagueId/teams/:leagueTeamId",
  verifyJWT,
  attachActor,
  validate(leaguesValidation.leagueTeamParamSchema, "params"),
  leaguesController.unregister,
);

router.get(
  "/:leagueId/teams/:leagueTeamId/members/candidates",
  verifyJWT,
  attachActor,
  validate(leaguesValidation.leagueTeamParamSchema, "params"),
  validate(leaguesValidation.candidatesQuerySchema, "query"),
  leaguesController.listCandidates,
);

router.post(
  "/:leagueId/teams/:leagueTeamId/members",
  verifyJWT,
  attachActor,
  validate(leaguesValidation.leagueTeamParamSchema, "params"),
  validate(leaguesValidation.addMembersSchema),
  leaguesController.addMembers,
);

router.delete(
  "/:leagueId/teams/:leagueTeamId/members/:memberId",
  verifyJWT,
  attachActor,
  validate(leaguesValidation.leagueMemberParamSchema, "params"),
  leaguesController.removeMember,
);

export default router;
