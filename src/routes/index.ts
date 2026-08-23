import { Router } from "express";
import authRoutes from "../modules/people/auth/auth.routes.ts";
import playersRoutes from "../modules/people/players/players.routes.ts";
import coachesRoutes from "../modules/people/coaches/coaches.routes.ts";
import refereesRoutes from "../modules/people/referees/referees.routes.ts";
import organizationsRoutes from "../modules/competition/organizations/organizations.routes.ts";

const router = Router();

router.use("/auth", authRoutes);
router.use("/organizations", organizationsRoutes);
router.use("/players", playersRoutes);
router.use("/coaches", coachesRoutes);
router.use("/referees", refereesRoutes);

export default router;
