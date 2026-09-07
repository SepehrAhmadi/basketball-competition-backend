import { Router } from "express";
import validate from "../../../middleware/validate.ts";
import verifyJWT from "../../../middleware/auth/verifyJWT.middleware.ts";
import verifyRole from "../../../middleware/auth/verifyRole.middleware.ts";
import createUploader from "../../../middleware/upload/createUploader.ts";
import uploadConfig from "../../../config/upload.config.ts";
import { idParamSchema } from "../../../shared/schemas.validation.ts";
import organizationsValidation from "./organizations.validation.ts";
import verifyOrgAccess from "./organizations.middleware.ts";
import organizationsController from "./organizations.controller.ts";

const router = Router();

const organizationLogoUploader = createUploader({
  destination: "organizations",
  ...uploadConfig.organizationLogo,
});

router.get(
  "/",
  verifyJWT,
  validate(organizationsValidation.organizationListQuerySchema, "query"),
  organizationsController.getAll,
);

router.get(
  "/:id",
  verifyJWT,
  validate(idParamSchema, "params"),
  verifyOrgAccess,
  organizationsController.getById,
);

router.post(
  "/",
  verifyJWT,
  verifyRole("ORG_MANAGER", "ADMIN"),
  organizationLogoUploader.single("logo"),
  validate(organizationsValidation.createOrganizationSchema),
  organizationsController.create,
);

router.put(
  "/:id",
  verifyJWT,
  verifyRole("ORG_MANAGER", "ADMIN"),
  validate(idParamSchema, "params"),
  verifyOrgAccess,
  organizationLogoUploader.single("logo"),
  validate(organizationsValidation.updateOrganizationSchema),
  organizationsController.update,
);

router.delete(
  "/:id",
  verifyJWT,
  verifyRole("ORG_MANAGER", "ADMIN"),
  validate(idParamSchema, "params"),
  verifyOrgAccess,
  organizationsController.remove,
);

export default router;
