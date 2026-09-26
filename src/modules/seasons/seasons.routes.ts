import { Router } from "express";
import validate from "../../middleware/validate.ts";
import seasonValidation from "./seasons.validation.ts";
import seasonsController from "./season.controller.ts";
import verifyJWT from "../../middleware/auth/verifyJWT.middleware.ts";
import verifyAdminLevel from "../../middleware/auth/verifyAdminLevel.middleware.ts";
import verifyPermission from "../../middleware/auth/verifyPermission.middleware.ts";

const router = Router();

// ─── Public reads (no auth) ──────────────────────────────────────────────

router.get(
  "/",
  validate(seasonValidation.seasonListQuerySchema, "query"),
  seasonsController.listSeasons,
);

router.get(
  "/:seasonId",
  validate(seasonValidation.seasonIdParamSchema, "params"),
  seasonsController.getSeason,
);

// ─── Protected mutations (ADMIN only) ─────────────────────────────────────

router.post(
  "/",
  verifyJWT,
  verifyAdminLevel("ADMIN", "SUPER_ADMIN"),
  verifyPermission("seasons.create"),
  validate(seasonValidation.createSeasonSchema),
  seasonsController.createSeason,
);

router.put(
  "/:seasonId",
  verifyJWT,
  verifyAdminLevel("ADMIN", "SUPER_ADMIN"),
  verifyPermission("seasons.update"),
  validate(seasonValidation.seasonIdParamSchema, "params"),
  validate(seasonValidation.updateSeasonSchema),
  seasonsController.updateSeason,
);

router.delete(
  "/:seasonId",
  verifyJWT,
  verifyAdminLevel("ADMIN", "SUPER_ADMIN"),
  verifyPermission("seasons.delete"),
  validate(seasonValidation.seasonIdParamSchema, "params"),
  seasonsController.deleteSeason,
);

export default router;