import { Router } from "express";
import seasonsController from "./seasons.controller.ts";

const router = Router();

router.get("/", seasonsController.getAllSeasons);

export default router;
