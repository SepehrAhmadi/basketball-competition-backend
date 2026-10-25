import { Router } from "express";
import rolesController from "./roles.controller.ts";

const router = Router();

router.get("/", rolesController.getAllRoles);

export default router;
