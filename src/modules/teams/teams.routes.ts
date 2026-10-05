import { Router } from "express";
import validate from "../../middleware/validate.ts";
import verifyJWT from "../../middleware/auth/verifyJWT.middleware.ts";
import optionalJWT from "../../middleware/auth/optionalJWT.middleware.ts";
import { attachActor, optionalActor } from "../../middleware/auth/attachActor.middleware.ts";
import createUploader from "../../middleware/upload/createUploader.ts";
import uploadConfig from "../../config/upload.config.ts";
import teamsValidation from "./teams.validation.ts";
import teamsController from "./teams.controller.ts";
import { paginationQuerySchema } from "../../shared/schemas.validation.ts";

const router = Router();

const listTeamsQuerySchema = paginationQuerySchema.extend({
  organizationId: teamsValidation.createTeamSchema.shape.organizationId.optional(),
});

const teamLogoUploader = createUploader({
  destination: "team-logos",
  ...uploadConfig.teamLogo,
});

// ─── Public reads (no auth) ──────────────────────────────────────────────

router.get(
  "/",
  validate(listTeamsQuerySchema, "query"),
  teamsController.listTeams,
);

router.get(
  "/:teamId",
  optionalJWT,
  optionalActor,
  validate(teamsValidation.teamIdParamSchema, "params"),
  teamsController.getTeam,
);

router.get(
  "/:teamId/roster",
  optionalJWT,
  optionalActor,
  validate(teamsValidation.teamIdParamSchema, "params"),
  validate(teamsValidation.rosterQuerySchema, "query"),
  teamsController.getRoster,
);

// ─── Protected mutations ──────────────────────────────────────────────────

router.post(
  "/",
  verifyJWT,
  attachActor,
  teamLogoUploader.single("logo"),
  validate(teamsValidation.createTeamSchema),
  teamsController.createTeam,
);

router.put(
  "/:teamId",
  verifyJWT,
  attachActor,
  validate(teamsValidation.teamIdParamSchema, "params"),
  teamLogoUploader.single("logo"),
  validate(teamsValidation.updateTeamSchema),
  teamsController.updateTeam,
);

router.delete(
  "/:teamId",
  verifyJWT,
  attachActor,
  validate(teamsValidation.teamIdParamSchema, "params"),
  teamsController.deleteTeam,
);

router.put(
  "/:teamId/logo",
  verifyJWT,
  attachActor,
  validate(teamsValidation.teamIdParamSchema, "params"),
  teamLogoUploader.single("logo"),
  teamsController.updateLogo,
);

router.post(
  "/:teamId/roster",
  verifyJWT,
  attachActor,
  validate(teamsValidation.teamIdParamSchema, "params"),
  validate(teamsValidation.addRosterMemberSchema),
  teamsController.addRosterMember,
);

router.put(
  "/:teamId/roster/:memberId",
  verifyJWT,
  attachActor,
  validate(teamsValidation.teamIdParamSchema, "params"),
  validate(teamsValidation.updateRosterMemberSchema),
  teamsController.updateRosterMember,
);

router.delete(
  "/:teamId/roster/:memberId",
  verifyJWT,
  attachActor,
  validate(teamsValidation.teamIdParamSchema, "params"),
  validate(teamsValidation.removeRosterMemberSchema),
  teamsController.removeRosterMember,
);

export default router;
