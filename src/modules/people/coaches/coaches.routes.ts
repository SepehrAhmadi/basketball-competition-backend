import { Router } from "express";
import validate from "../../../middleware/validate.ts";
import verifyJWT from "../../../middleware/auth/verifyJWT.middleware.ts";
import verifyRole from "../../../middleware/auth/verifyRole.middleware.ts";
import coachesValidation from "./coaches.validation.ts";
import coachesController from "./coaches.controller.ts";

const router = Router();

router.get("/me", verifyJWT, verifyRole("COACH"), coachesController.getMe);
router.put(
  "/me",
  verifyJWT,
  verifyRole("COACH"),
  validate(coachesValidation.upsertCoachSchema),
  coachesController.updateMe,
);

export default router;
