import { Router } from "express";
import validate from "../../middleware/validate.ts";
import verifyJWT from "../../middleware/auth/verifyJWT.middleware.ts";
import { attachActor } from "../../middleware/auth/attachActor.middleware.ts";
import createUploader from "../../middleware/upload/createUploader.ts";
import uploadConfig from "../../config/upload.config.ts";
import { idParamSchema } from "../../shared/schemas.validation.ts";
import organizationsValidation from "./organizations.validation.ts";
import organizationsController from "./organizations.controller.ts";

const router = Router();

const organizationLogoUploader = createUploader({
  destination: "organizations",
  ...uploadConfig.organizationLogo,
});

router.get(
  "/",
  verifyJWT,
  attachActor,
  validate(organizationsValidation.organizationListQuerySchema, "query"),
  organizationsController.getAll,
);

router.get(
  "/:id",
  verifyJWT,
  attachActor,
  validate(idParamSchema, "params"),
  organizationsController.getById,
);

router.post(
  "/",
  verifyJWT,
  attachActor,
  organizationLogoUploader.single("logo"),
  validate(organizationsValidation.createOrganizationSchema),
  organizationsController.create,
);

router.put(
  "/:id",
  verifyJWT,
  attachActor,
  validate(idParamSchema, "params"),
  organizationLogoUploader.single("logo"),
  validate(organizationsValidation.updateOrganizationSchema),
  organizationsController.update,
);

router.delete(
  "/:id",
  verifyJWT,
  attachActor,
  validate(idParamSchema, "params"),
  organizationsController.remove,
);

export default router;
