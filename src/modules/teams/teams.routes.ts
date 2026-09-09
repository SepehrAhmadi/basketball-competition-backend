import { Router } from "express";
import validate from "../../middleware/validate.ts";
import verifyJWT from "../../middleware/auth/verifyJWT.middleware.ts";
import verifyRole from "../../middleware/auth/verifyRole.middleware.ts";
import verifyTeamAccess from "../../middleware/auth/verifyTeamAccess.middleware.ts";
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
  validate(teamsValidation.teamIdParamSchema, "params"),
  teamsController.getTeam,
);

router.get(
  "/:teamId/roster",
  validate(teamsValidation.teamIdParamSchema, "params"),
  validate(teamsValidation.rosterQuerySchema, "query"),
  teamsController.getRoster,
);

// ─── Protected mutations ──────────────────────────────────────────────────

router.post(
  "/",
  verifyJWT,
  verifyRole("ORG_MANAGER", "ADMIN"),
  teamLogoUploader.single("logo"),
  validate(teamsValidation.createTeamSchema),
  teamsController.createTeam,
);

router.put(
  "/:teamId",
  verifyJWT,
  verifyRole("ORG_MANAGER", "ADMIN"),
  validate(teamsValidation.teamIdParamSchema, "params"),
  verifyTeamAccess,
  teamLogoUploader.single("logo"),
  validate(teamsValidation.updateTeamSchema),
  teamsController.updateTeam,
);

router.delete(
  "/:teamId",
  verifyJWT,
  verifyRole("ORG_MANAGER", "ADMIN"),
  validate(teamsValidation.teamIdParamSchema, "params"),
  verifyTeamAccess,
  teamsController.deleteTeam,
);

router.put(
  "/:teamId/logo",
  verifyJWT,
  verifyRole("ORG_MANAGER", "ADMIN"),
  validate(teamsValidation.teamIdParamSchema, "params"),
  verifyTeamAccess,
  teamLogoUploader.single("logo"),
  teamsController.updateLogo,
);

router.post(
  "/:teamId/roster",
  verifyJWT,
  verifyRole("ORG_MANAGER", "COACH", "ADMIN"),
  validate(teamsValidation.teamIdParamSchema, "params"),
  verifyTeamAccess,
  validate(teamsValidation.addRosterMemberSchema),
  teamsController.addRosterMember,
);

router.put(
  "/:teamId/roster/:memberId",
  verifyJWT,
  verifyRole("ORG_MANAGER", "COACH", "ADMIN"),
  validate(teamsValidation.teamIdParamSchema, "params"),
  verifyTeamAccess,
  validate(teamsValidation.updateRosterMemberSchema),
  teamsController.updateRosterMember,
);

router.delete(
  "/:teamId/roster/:memberId",
  verifyJWT,
  verifyRole("ORG_MANAGER", "COACH", "ADMIN"),
  validate(teamsValidation.teamIdParamSchema, "params"),
  verifyTeamAccess,
  validate(teamsValidation.removeRosterMemberSchema),
  teamsController.removeRosterMember,
);

export default router;
