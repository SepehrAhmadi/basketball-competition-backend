import { Router } from "express";
import validate from "../../../middleware/validate.ts";
import optionalJWT from "../../../middleware/auth/optionalJWT.middleware.ts";
import { optionalActor } from "../../../middleware/auth/attachActor.middleware.ts";
import gamesValidation from "./games.validation.ts";
import gamesController from "./games.controller.ts";

const router = Router({ mergeParams: true });

router.get(
  "/",
  optionalJWT,
  optionalActor,
  validate(gamesValidation.leagueIdParamSchema, "params"),
  validate(gamesValidation.publicGamesQuerySchema, "query"),
  gamesController.list,
);

router.get(
  "/:gameId",
  optionalJWT,
  optionalActor,
  validate(gamesValidation.gameIdParamSchema, "params"),
  gamesController.get,
);

export default router;
