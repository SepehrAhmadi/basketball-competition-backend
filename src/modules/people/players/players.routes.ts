import { Router } from "express";
import validate from "../../../middleware/validate.ts";
import verifyJWT from "../../../middleware/auth/verifyJWT.middleware.ts";
import verifyRole from "../../../middleware/auth/verifyRole.middleware.ts";
import playersValidation from "./players.validation.ts";
import playersController from "./players.controller.ts";

const router = Router();

router.get("/me", verifyJWT, verifyRole("PLAYER"), playersController.getMe);
router.put(
  "/me",
  verifyJWT,
  verifyRole("PLAYER"),
  validate(playersValidation.upsertPlayerSchema),
  playersController.updateMe,
);

export default router;
