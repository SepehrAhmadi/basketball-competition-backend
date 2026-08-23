import { Router } from "express";
import validate from "../../../middleware/validate.ts";
import verifyJWT from "../../../middleware/auth/verifyJWT.middleware.ts";
import verifyRole from "../../../middleware/auth/verifyRole.middleware.ts";
import refereesValidation from "./referees.validation.ts";
import refereesController from "./referees.controller.ts";

const router = Router();

router.get("/me", verifyJWT, verifyRole("REFEREE"), refereesController.getMe);
router.put(
  "/me",
  verifyJWT,
  verifyRole("REFEREE"),
  validate(refereesValidation.upsertRefereeSchema),
  refereesController.updateMe,
);

export default router;
