import { Router } from "express";
import refereeLevelsController from "./referee-levels.controller.ts";

const router = Router();

router.get("/", refereeLevelsController.getAllLevels);

export default router;
