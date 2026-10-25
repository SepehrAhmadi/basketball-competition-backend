import { Router } from "express";
import rolesRoutes from "./roles/roles.routes.ts";
import coachDegreesRoutes from "./coach-degrees/coach-degrees.routes.ts";
import refereeLevelsRoutes from "./referee-levels/referee-levels.routes.ts";
import leagueStatusesRoutes from "./league-statuses/league-statuses.routes.ts";
import leagueFormatsRoutes from "./league-formats/league-formats.routes.ts";
import groupRoundTypesRoutes from "./group-round-types/group-round-types.routes.ts";

const router = Router();

router.use("/roles", rolesRoutes);
router.use("/coach-degrees", coachDegreesRoutes);
router.use("/referee-levels", refereeLevelsRoutes);
router.use("/league-statuses", leagueStatusesRoutes);
router.use("/league-formats", leagueFormatsRoutes);
router.use("/group-round-types", groupRoundTypesRoutes);

export default router;
