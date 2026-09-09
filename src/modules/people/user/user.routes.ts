import { Router } from "express";
import validate from "../../../middleware/validate.ts";
import verifyJWT from "../../../middleware/auth/verifyJWT.middleware.ts";
import createUploader from "../../../middleware/upload/createUploader.ts";
import userValidation from "./user.validation.ts";
import userController from "./user.controller.ts";

const router = Router();

// All self-service routes require authentication; identity comes from req.userId.
router.use(verifyJWT);

const avatarUpload = createUploader({
  destination: "avatars",
  maxSizeMb: 2,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
});

router.get("/me", userController.getMe);

router.patch(
  "/me",
  validate(userValidation.updateProfileSchema),
  userController.updateMe,
);

router.post(
  "/me/avatar",
  avatarUpload.single("file"),
  userController.uploadAvatar,
);
router.delete("/me/avatar", userController.removeAvatar);

router.patch(
  "/me/password",
  validate(userValidation.changePasswordSchema),
  userController.changePassword,
);

router.delete("/me", userController.deleteMe);

router.get(
  "/search",
  validate(userValidation.searchUsersQuerySchema, "query"),
  userController.searchUsers,
);

export default router;
