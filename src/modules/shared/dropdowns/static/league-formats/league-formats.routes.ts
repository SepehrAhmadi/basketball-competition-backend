import { Router } from "express";
import leagueFormatsController from "./league-formats.controller.ts";

const router = Router();

router.get("/", leagueFormatsController.getAll);

export default router;
