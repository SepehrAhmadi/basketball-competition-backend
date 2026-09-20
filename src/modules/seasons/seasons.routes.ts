import { Router } from "express";
import validate from "../../middleware/validate.ts";
import seasonValidation from "./seasons.validation.ts";
import seasonsController from "./season.controller.ts";
import verifyJWT from "../../middleware/auth/verifyJWT.middleware.ts";
import verifyRole from "../../middleware/auth/verifyRole.middleware.ts";

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
  verifyRole("ADMIN"),
  validate(seasonValidation.createSeasonSchema),
  seasonsController.createSeason,
);

router.put(
  "/:seasonId",
  verifyJWT,
  verifyRole("ADMIN"),
  validate(seasonValidation.seasonIdParamSchema, "params"),
  validate(seasonValidation.updateSeasonSchema),
  seasonsController.updateSeason,
);

router.delete(
  "/:seasonId",
  verifyJWT,
  verifyRole("ADMIN"),
  validate(seasonValidation.seasonIdParamSchema, "params"),
  seasonsController.deleteSeason,
);

export default router;