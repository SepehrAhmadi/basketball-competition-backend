import { Router } from "express";
import validate from "../../../middleware/validate.ts";
import dropdownsValidation from "./dropdowns.validation.ts";
import dropdownsController from "./dropdowns.controller.ts";

const router = Router();

// Public read-only mirrors of the authenticated DB dropdowns — no verifyJWT.
// Data is non-sensitive (id + name, isActive) and already exposed via public GET /seasons.
router.get(
  "/seasons",
  validate(dropdownsValidation.dropdownSearchQuerySchema, "query"),
  dropdownsController.getSeasons,
);

router.get(
  "/age-categories",
  validate(dropdownsValidation.dropdownSearchQuerySchema, "query"),
  dropdownsController.getAgeCategories,
);

export default router;
