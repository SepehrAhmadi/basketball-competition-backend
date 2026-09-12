import { z } from "zod";
import { messages } from "../../../language/message.ts";
import { registry } from "../../../swagger/registry.ts";
import {
  errorResponseSchema,
  successResponseSchema,
} from "../../../swagger/helpers.ts";
import { paginatedResponseSchema } from "../../../shared/schemas.validation.ts";
import {
  updateProfileSchema,
  changePasswordSchema,
  searchUsersQuerySchema,
} from "./user.validation.ts";

const roleEnum = z
  .enum(["ADMIN", "ORG_MANAGER", "COACH", "PLAYER", "REFEREE", "PUBLIC"])
  .openapi("Role");

export const userProfileSchema = z
  .object({
    id: z.number().openapi({ example: 12 }),
    fullName: z.string().openapi({ example: "Ali Rezaei" }),
    phone: z.string().openapi({ example: "09121234567" }),
    email: z.string().openapi({ example: "ali@example.com" }),
    avatarUrl: z.string().nullable().openapi({
      description: "Absolute public URL built from PROJECT_URL",
      example: "http://localhost:8081/uploads/avatars/12.webp",
    }),
    birthDate: z
      .string()
      .nullable()
      .openapi({ example: "1381/05/20" }),
    nationalId: z.string().nullable().openapi({ example: "0012345678" }),
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "DELETED"]).openapi({
      example: "ACTIVE",
    }),
    roles: z.array(roleEnum).openapi({ example: ["PLAYER"] }),
    createdAt: z.date().openapi({ example: "2026-09-06T08:00:00.000Z" }),
  })
  .openapi("UserProfile");

const avatarDataSchema = z.object({
  avatarUrl: z.string().openapi({
    description: "Absolute public URL built from PROJECT_URL",
    example: "http://localhost:8081/uploads/avatars/12.webp",
  }),
});

const avatarUploadRequestSchema = z
  .object({
    file: z.string().openapi({
      description: "Avatar image (JPEG/PNG/WEBP, max 2MB)",
      type: "string",
      format: "binary",
    }),
  })
  .openapi("AvatarUploadRequest");

const unauthorizedError = errorResponseSchema(401, "Unauthorized");
const notFoundError = errorResponseSchema(404, messages.error.user.notFound);
const conflictError = errorResponseSchema(
  409,
  messages.error.auth.phoneOrEmailInUse,
);

registry.registerPath({
  method: "get",
  path: "/users/me",
  tags: ["Users"],
  summary: "Get own profile",
  description:
    "Returns the authenticated user's safe profile. Never includes password hashes or refresh tokens.",
  request: {},
  responses: {
    "200": {
      description: "Own profile",
      content: {
        "application/json": {
          schema: successResponseSchema(userProfileSchema, {
            messageExample: messages.success.user.profileFetched,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: {
        "application/json": { schema: unauthorizedError },
      },
    },
    "404": {
      description: "User not found",
      content: {
        "application/json": { schema: notFoundError },
      },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/users/me",
  tags: ["Users"],
  summary: "Update own profile",
  description:
    "Updates only self-service editable fields (fullName, phone, email, birthDate, nationalId). Roles, status, and passwords cannot be changed here.",
  request: {
    body: {
      content: { "application/json": { schema: updateProfileSchema } },
    },
  },
  responses: {
    "200": {
      description: "Profile updated",
      content: {
        "application/json": {
          schema: successResponseSchema(userProfileSchema, {
            messageExample: messages.success.user.profileUpdated,
          }),
        },
      },
    },
    "400": {
      description: "Validation error",
      content: {
        "application/json": {
          schema: errorResponseSchema(400, "Validation failed"),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: {
        "application/json": { schema: unauthorizedError },
      },
    },
    "404": {
      description: "User not found",
      content: {
        "application/json": { schema: notFoundError },
      },
    },
    "409": {
      description: "Phone number or email already in use",
      content: {
        "application/json": { schema: conflictError },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/users/me/avatar",
  tags: ["Users"],
  summary: "Upload/change own avatar",
  description:
    "Accepts multipart/form-data with a single image file field named `file` (JPEG/PNG/WEBP, max 2MB). Replaces the existing avatar when present.",
  request: {
    body: {
      content: {
        "multipart/form-data": { schema: avatarUploadRequestSchema },
      },
    },
  },
  responses: {
    "200": {
      description: "Avatar uploaded",
      content: {
        "application/json": {
          schema: successResponseSchema(avatarDataSchema, {
            messageExample: messages.success.user.avatarUploaded,
          }),
        },
      },
    },
    "400": {
      description: "Invalid file type or missing file",
      content: {
        "application/json": {
          schema: errorResponseSchema(400, "Validation failed"),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: {
        "application/json": { schema: unauthorizedError },
      },
    },
    "404": {
      description: "User not found",
      content: {
        "application/json": { schema: notFoundError },
      },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/users/me/avatar",
  tags: ["Users"],
  summary: "Remove own avatar",
  description:
    "Removes the avatar file (when stored locally) and clears the avatar reference.",
  request: {},
  responses: {
    "200": {
      description: "Avatar removed",
      content: {
        "application/json": {
          schema: successResponseSchema(z.null(), {
            messageExample: messages.success.user.avatarRemoved,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: {
        "application/json": { schema: unauthorizedError },
      },
    },
    "404": {
      description: "User or avatar not found",
      content: {
        "application/json": { schema: notFoundError },
      },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/users/me/password",
  tags: ["Users"],
  summary: "Change own password",
  description:
    "Verifies the current password, hashes the new password, and invalidates the stored refresh token.",
  request: {
    body: {
      content: { "application/json": { schema: changePasswordSchema } },
    },
  },
  responses: {
    "200": {
      description: "Password changed",
      content: {
        "application/json": {
          schema: successResponseSchema(z.null(), {
            messageExample: messages.success.user.passwordChanged,
          }),
        },
      },
    },
    "400": {
      description: "Validation error or incorrect current password",
      content: {
        "application/json": {
          schema: errorResponseSchema(
            400,
            messages.error.user.currentPasswordIncorrect,
          ),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: {
        "application/json": { schema: unauthorizedError },
      },
    },
    "404": {
      description: "User not found",
      content: {
        "application/json": { schema: notFoundError },
      },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/users/me",
  tags: ["Users"],
  summary: "Delete own account",
  description:
    "Soft-deletes the authenticated account (status becomes DELETED) and clears the session cookie.",
  request: {},
  responses: {
    "200": {
      description: "Account deleted",
      content: {
        "application/json": {
          schema: successResponseSchema(z.null(), {
            messageExample: messages.success.user.accountDeleted,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: {
        "application/json": { schema: unauthorizedError },
      },
    },
  },
});

// ---- Search users ----

const searchUserItemSchema = z
  .object({
    id: z.number().openapi({ example: 12 }),
    fullName: z.string().openapi({ example: "Ali Rezaei" }),
    phone: z.string().openapi({ example: "09121234567" }),
    avatarUrl: z
      .string()
      .nullable()
      .openapi({
        example: "http://localhost:8081/uploads/avatars/12.webp",
      }),
  })
  .openapi("SearchUserItem");

const searchUsersResponseSchema = paginatedResponseSchema(searchUserItemSchema);

registry.registerPath({
  method: "get",
  path: "/users/search",
  tags: ["Users"],
  summary: "Search users",
  description:
    "Paginated search for active users. Optionally filter by role (COACH, PLAYER, REFEREE) and/or a free-text query matching fullName or phone.",
  request: {
    query: searchUsersQuerySchema,
  },
  responses: {
    "200": {
      description: "Paginated list of matching users",
      content: {
        "application/json": {
          schema: successResponseSchema(searchUsersResponseSchema, {
            messageExample: "Users found",
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: {
        "application/json": { schema: unauthorizedError },
      },
    },
  },
});
