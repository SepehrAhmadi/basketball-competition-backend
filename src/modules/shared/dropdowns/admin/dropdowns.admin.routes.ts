import { Router } from "express";
import validate from "../../../../middleware/validate.ts";
import verifyJWT from "../../../../middleware/auth/verifyJWT.middleware.ts";
import verifyAdminLevel from "../../../../middleware/auth/verifyAdminLevel.middleware.ts";
import dropdownsValidation from "../dropdowns.validation.ts";
import dropdownsController from "../dropdowns.controller.ts";

const router = Router();

router.use(verifyJWT);
router.use(verifyAdminLevel("ADMIN", "SUPER_ADMIN"));

// Admin-only league selector: every status is returned, including INACTIVE drafts.
router.get(
  "/leagues",
  validate(dropdownsValidation.adminLeagueDropdownQuerySchema, "query"),
  dropdownsController.getLeagues,
);

router.get(
  "/league-groups",
  validate(dropdownsValidation.adminLeagueGroupsDropdownQuerySchema, "query"),
  dropdownsController.getLeagueGroups,
);

router.get(
  "/league-teams",
  validate(dropdownsValidation.adminLeagueTeamsDropdownQuerySchema, "query"),
  dropdownsController.getLeagueTeams,
);

export default router;
