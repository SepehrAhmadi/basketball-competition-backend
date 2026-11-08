import { Router } from "express";
import gameStatusesController from "./game-statuses.controller.ts";

const router = Router();

router.get("/", gameStatusesController.getAll);

export default router;
