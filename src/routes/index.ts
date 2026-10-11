import { Router } from "express";
import authRoutes from "../modules/people/auth/auth.routes.ts";
import userRoutes from "../modules/people/user/user.routes.ts";
import adminUsersRoutes from "../modules/people/user/admin/users.admin.routes.ts";
import playersRoutes from "../modules/people/players/players.routes.ts";
import coachesRoutes from "../modules/people/coaches/coaches.routes.ts";
import refereesRoutes from "../modules/people/referees/referees.routes.ts";
import organizationsRoutes from "../modules/organizations/organizations.routes.ts";
import organizationsAdminRoutes from "../modules/organizations/admin/organizations.admin.routes.ts";
import teamsRoutes from "../modules/teams/teams.routes.ts";
import teamsAdminRoutes from "../modules/teams/admin/teams.admin.routes.ts";
import rolesRoutes from "../modules/shared/roles/roles.routes.ts";
import dropdownsRoutes from "../modules/shared/dropdowns/dropdowns.routes.ts";
import coachDegreesRoutes from "../modules/shared/coach-degrees/coach-degrees.routes.ts";
import refereeLevelsRoutes from "../modules/shared/referee-levels/referee-levels.routes.ts";
import seasonsRoutes from "../modules/seasons/seasons.routes.ts";
import ageCategoriesAdminRoutes from "../modules/age-categories/admin/age-categories/age-categories.admin.routes.ts";
import ageCategoryCutoffsAdminRoutes from "../modules/age-categories/admin/age-category-cutoffs/age-category-cutoffs.admin.routes.ts";
import leagueStatusesRoutes from "../modules/shared/league-statuses/league-statuses.routes.ts";
import leaguesRoutes from "../modules/competition/leagues/leagues.routes.ts";
import leaguesAdminRoutes from "../modules/competition/leagues/admin/leagues/leagues.admin.routes.ts";
import leagueTeamsAdminRoutes, {
  eligibleTeamsRouter,
} from "../modules/competition/leagues/admin/league-teams/league-teams.admin.routes.ts";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/admin/users", adminUsersRoutes);
router.use("/organizations", organizationsRoutes);
router.use("/admin/organizations", organizationsAdminRoutes);
router.use("/teams", teamsRoutes);
router.use("/admin/teams", teamsAdminRoutes);
router.use("/players", playersRoutes);
router.use("/coaches", coachesRoutes);
router.use("/referees", refereesRoutes);
router.use("/roles", rolesRoutes);
router.use("/dropdowns", dropdownsRoutes);
router.use("/coach-degrees", coachDegreesRoutes);
router.use("/referee-levels", refereeLevelsRoutes);
router.use("/seasons", seasonsRoutes);
router.use("/admin/age-categories", ageCategoriesAdminRoutes);
router.use("/admin/age-category-cutoffs", ageCategoryCutoffsAdminRoutes);
router.use("/league-statuses", leagueStatusesRoutes);
router.use("/leagues", leaguesRoutes);
router.use("/admin/leagues/:leagueId/teams", leagueTeamsAdminRoutes);
router.use("/admin/leagues/:leagueId/eligible-teams", eligibleTeamsRouter);
router.use("/admin/leagues", leaguesAdminRoutes);

export default router;
