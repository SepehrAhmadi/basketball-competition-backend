import { Router } from "express";
import leagueStatusesController from "./league-statuses.controller.ts";

const router = Router();

router.get("/", leagueStatusesController.getAll);

export default router;
