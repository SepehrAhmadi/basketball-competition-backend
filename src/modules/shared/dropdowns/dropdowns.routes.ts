import { Router } from "express";
import validate from "../../../middleware/validate.ts";
import verifyJWT from "../../../middleware/auth/verifyJWT.middleware.ts";
import dropdownsValidation from "./dropdowns.validation.ts";
import dropdownsController from "./dropdowns.controller.ts";

const router = Router();

// Authenticated reference data for filters/forms — no admin gate so every
// logged-in client (admin panel + PWA) can populate dropdowns from the server.
router.use(verifyJWT);

router.get("/organization-statuses", dropdownsController.getOrganizationStatuses);
router.get("/team-statuses", dropdownsController.getTeamStatuses);
router.get("/team-member-roles", dropdownsController.getTeamMemberRoles);

router.get(
  "/organizations",
  validate(dropdownsValidation.dropdownSearchQuerySchema, "query"),
  dropdownsController.getOrganizations,
);

router.get(
  "/teams",
  validate(dropdownsValidation.teamsDropdownQuerySchema, "query"),
  dropdownsController.getTeams,
);

router.get(
  "/seasons",
  validate(dropdownsValidation.dropdownSearchQuerySchema, "query"),
  dropdownsController.getSeasons,
);

router.get(
  "/manager-candidates",
  validate(dropdownsValidation.dropdownSearchQuerySchema, "query"),
  dropdownsController.getManagerCandidates,
);

router.get(
  "/users",
  validate(dropdownsValidation.usersDropdownQuerySchema, "query"),
  dropdownsController.getUsers,
);

router.get(
  "/age-categories",
  validate(dropdownsValidation.dropdownSearchQuerySchema, "query"),
  dropdownsController.getAgeCategories,
);

export default router;
