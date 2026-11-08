import { Router } from "express";
import validate from "../../../../middleware/validate.ts";
import verifyJWT from "../../../../middleware/auth/verifyJWT.middleware.ts";
import verifyAdminLevel from "../../../../middleware/auth/verifyAdminLevel.middleware.ts";
import verifyPermission from "../../../../middleware/auth/verifyPermission.middleware.ts";
import gamesAdminValidation from "./games.admin.validation.ts";
import gamesAdminController from "./games.admin.controller.ts";

const router = Router({ mergeParams: true });

router.use(verifyJWT);
router.use(verifyAdminLevel("ADMIN", "SUPER_ADMIN"));

router.get(
  "/",
  verifyPermission("games.view"),
  validate(gamesAdminValidation.leagueIdParamSchema, "params"),
  validate(gamesAdminValidation.gamesListQuerySchema, "query"),
  gamesAdminController.list,
);

router.get(
  "/:gameId",
  verifyPermission("games.view"),
  validate(gamesAdminValidation.gameIdParamSchema, "params"),
  gamesAdminController.get,
);

router.post(
  "/",
  verifyPermission("games.create"),
  validate(gamesAdminValidation.createGameSchema),
  validate(gamesAdminValidation.leagueIdParamSchema, "params"),
  gamesAdminController.create,
);

router.put(
  "/:gameId",
  verifyPermission("games.update"),
  validate(gamesAdminValidation.gameIdParamSchema, "params"),
  validate(gamesAdminValidation.updateGameScheduleSchema),
  gamesAdminController.updateSchedule,
);

router.patch(
  "/:gameId/status",
  verifyPermission("games.update"),
  validate(gamesAdminValidation.gameIdParamSchema, "params"),
  validate(gamesAdminValidation.updateGameStatusSchema),
  gamesAdminController.updateStatus,
);

router.put(
  "/:gameId/result",
  verifyPermission("games.result"),
  validate(gamesAdminValidation.gameIdParamSchema, "params"),
  validate(gamesAdminValidation.enterGameResultSchema),
  gamesAdminController.enterResult,
);

router.delete(
  "/:gameId/result",
  verifyPermission("games.result"),
  validate(gamesAdminValidation.gameIdParamSchema, "params"),
  gamesAdminController.clearResult,
);

router.delete(
  "/:gameId",
  verifyPermission("games.delete"),
  validate(gamesAdminValidation.gameIdParamSchema, "params"),
  gamesAdminController.remove,
);

export default router;
 