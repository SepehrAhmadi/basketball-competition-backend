import { Router } from "express";
import groupRoundTypesController from "./group-round-types.controller.ts";

const router = Router();

router.get("/", groupRoundTypesController.getAll);

export default router;
