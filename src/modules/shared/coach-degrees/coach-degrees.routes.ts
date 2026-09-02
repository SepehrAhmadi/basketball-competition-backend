import { Router } from "express";
import coachDegreesController from "./coach-degrees.controller.ts";

const router = Router();

router.get("/", coachDegreesController.getAllDegrees);

export default router;
