import { Router } from "express";
import validate from "../../../middleware/validate.ts";
import verifyJWT from "../../../middleware/auth/verifyJWT.middleware.ts";
import verifyRole from "../../../middleware/auth/verifyRole.middleware.ts";
import schemas from "../../../shared/schemas.validation.ts";
import organizationsValidation from "./organizations.validation.ts";
import verifyOrgAccess from "./organizations.middleware.ts";
import organizationsController from "./organizations.controller.ts";

const router = Router();

router.get("/", verifyJWT, organizationsController.getAll);

router.get(
  "/:id",
  verifyJWT,
  validate(schemas.idParamSchema, "params"),
  verifyOrgAccess,
  organizationsController.getById,
);

router.post(
  "/",
  verifyJWT,
  verifyRole("ORG_MANAGER", "ADMIN"),
  validate(organizationsValidation.createOrganizationSchema),
  organizationsController.create,
);

router.put(
  "/:id",
  verifyJWT,
  verifyRole("ORG_MANAGER", "ADMIN"),
  validate(schemas.idParamSchema, "params"),
  verifyOrgAccess,
  validate(organizationsValidation.updateOrganizationSchema),
  organizationsController.update,
);

router.delete(
  "/:id",
  verifyJWT,
  verifyRole("ORG_MANAGER", "ADMIN"),
  validate(schemas.idParamSchema, "params"),
  verifyOrgAccess,
  organizationsController.remove,
);

export default router;
