import { z } from "zod";
import { messages } from "../../../language/message.ts";
import { registry } from "../../../swagger/registry.ts";
import {
  errorResponseSchema,
  successResponseSchema,
} from "../../../swagger/helpers.ts";
import { paginatedResponseSchema } from "../../../shared/schemas.validation.ts";
import { idParamSchema } from "../../../shared/schemas.validation.ts";
import {
  adminCreateUserSchema,
  listUsersQuerySchema,
  updateUserByAdminSchema,
  adminResetPasswordSchema,
  roleSchema,
} from "./admin-users.validation.ts";

// ---- response models ----
const roleEnum = roleSchema;

const userProfileSchema = z
  .object({
    id: z.number().openapi({ example: 12 }),
    fullName: z.string().openapi({ example: "Ali Rezaei" }),
    phone: z.string().openapi({ example: "09121234567" }),
    email: z.string().openapi({ example: "ali@example.com" }),
    avatarUrl: z.string().nullable().openapi({
      description: "Absolute public URL built from PROJECT_URL",
      example: "http://localhost:8081/uploads/avatars/12.webp",
    }),
    birthDate: z.string().nullable().openapi({ example: "1381/05/20" }),
    nationalId: z.string().nullable().openapi({ example: "0012345678" }),
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "DELETED"]).openapi({
      example: "ACTIVE",
    }),
    roles: z.array(roleEnum).openapi({ example: ["PLAYER"] }),
    createdAt: z.date().openapi({ example: "2026-09-06T08:00:00.000Z" }),
  })
  .openapi("AdminUserProfile");

const createdUserSchema = z.object({
  id: z.number().openapi({ example: 10 }),
});

const adminUsersResponseSchema = paginatedResponseSchema(userProfileSchema);

const unauthorizedError = errorResponseSchema(401, "Unauthorized");
const forbiddenError = errorResponseSchema(403, "Forbidden");
const notFoundError = errorResponseSchema(404, messages.error.user.notFound);
const conflictError = errorResponseSchema(
  409,
  messages.error.auth.phoneOrEmailInUse,
);

// ---- path registrations ----

registry.registerPath({
  method: "post",
  path: "/admin/users",
  tags: ["Admin Users"],
  summary: "Create a user",
  description:
    "Admin-only endpoint to create any kind of user, including ADMIN accounts. Returns the new user's id.",
  request: {
    body: {
      content: { "application/json": { schema: adminCreateUserSchema } },
    },
  },
  responses: {
    "201": {
      description: "User created",
      content: {
        "application/json": {
          schema: successResponseSchema(createdUserSchema, {
            statusCode: 201,
            messageExample: messages.success.auth.userCreated,
          }),
        },
      },
    },
    "400": {
      description: "Validation error",
      content: {
        "application/json": {
          schema: errorResponseSchema(
            400,
            `password: ${messages.error.auth.passwordMinLength}`,
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
    "403": {
      description: "Requires the ADMIN role",
      content: {
        "application/json": { schema: forbiddenError },
      },
    },
    "409": {
      description: "Phone number or email already registered",
      content: {
        "application/json": { schema: conflictError },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/admin/users",
  tags: ["Admin Users"],
  summary: "List users",
  description:
    "Admin-only paginated user list for the user-management screen. Supports page/pageSize plus optional query, role, and status filters. Unlike /users/search, inactive/suspended/deleted users are included unless filtered.",
  request: {
    query: listUsersQuerySchema,
  },
  responses: {
    "200": {
      description: "Paginated list of users",
      content: {
        "application/json": {
          schema: successResponseSchema(adminUsersResponseSchema, {
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
    "403": {
      description: "Admin role required",
      content: {
        "application/json": { schema: forbiddenError },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/admin/users/{id}",
  tags: ["Admin Users"],
  summary: "Get user by id",
  description:
    "Returns one user's safe profile including roles. Never includes password hashes or refresh tokens.",
  request: {
    params: idParamSchema,
  },
  responses: {
    "200": {
      description: "User profile",
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
    "403": {
      description: "Admin role required",
      content: {
        "application/json": { schema: forbiddenError },
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
  method: "put",
  path: "/admin/users/{id}",
  tags: ["Admin Users"],
  summary: "Update user",
  description:
    "Admin-only edit of another user's profile fields and roles. The roles array is treated as the complete selection and synchronized exactly.",
  request: {
    params: idParamSchema,
    body: {
      content: { "application/json": { schema: updateUserByAdminSchema } },
    },
  },
  responses: {
    "200": {
      description: "User updated",
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
    "403": {
      description: "Admin role required",
      content: {
        "application/json": { schema: forbiddenError },
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
  method: "delete",
  path: "/admin/users/{id}",
  tags: ["Admin Users"],
  summary: "Delete a user",
  description:
    "Admin-only soft delete of the target user (status becomes DELETED).",
  request: {
    params: idParamSchema,
  },
  responses: {
    "200": {
      description: "User deleted",
      content: {
        "application/json": {
          schema: successResponseSchema(z.null(), {
            messageExample: messages.success.auth.userDeleted,
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
        "application/json": {
          schema: errorResponseSchema(404, messages.error.user.notFound),
        },
      },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/admin/users/{id}/password",
  tags: ["Admin Users"],
  summary: "Reset user password",
  description:
    "Admin-only endpoint to set a new password for any user without requiring the current password. Clears the user's refresh token, forcing re-login.",
  request: {
    params: idParamSchema,
    body: {
      content: { "application/json": { schema: adminResetPasswordSchema } },
    },
  },
  responses: {
    "200": {
      description: "Password reset successfully",
      content: {
        "application/json": {
          schema: successResponseSchema(z.null(), {
            messageExample: messages.success.user.passwordChanged,
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
    "403": {
      description: "Admin role required",
      content: {
        "application/json": { schema: forbiddenError },
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
