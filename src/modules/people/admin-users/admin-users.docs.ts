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
  setAdminStatusSchema,
  replacePermissionsSchema,
} from "./admin-users.validation.ts";
import { PERMISSION_CODES } from "../../../shared/permissions.ts";

// ---- response models ----
// Display-only: broader than `roleSchema` (which only covers roles the admin
// endpoints let you *assign*), since a listed user's roles can include
// ADMIN/SUPER_ADMIN even though those aren't assignable via this schema.
const roleEnum = z.enum([
  "SUPER_ADMIN",
  "ADMIN",
  "ORG_MANAGER",
  "COACH",
  "PLAYER",
  "REFEREE",
  "PUBLIC",
]).openapi("Role");

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
    "Admin-only endpoint to create a user with any non-admin role (ORG_MANAGER, COACH, PLAYER, REFEREE, PUBLIC). ADMIN/SUPER_ADMIN cannot be granted here — use PUT /admin/users/{id}/admin-status. Returns the new user's id.",
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
    "Admin-only paginated user list for the user-management screen. Supports page/pageSize plus optional query, role, and status filters. Unlike /users/search, inactive/suspended/deleted users are included unless filtered. Regular ADMINs only see users with non-admin roles (ORG_MANAGER, COACH, PLAYER, REFEREE, PUBLIC) — ADMIN and SUPER_ADMIN users are hidden. SUPER_ADMIN sees all users.",
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
    "Returns one user's safe profile including roles. Never includes password hashes or refresh tokens. Regular ADMINs cannot view ADMIN or SUPER_ADMIN users (403).",
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
    "Admin-only edit of another user's profile fields and non-admin roles. The roles array is treated as the complete selection and synchronized exactly; it cannot contain ADMIN or SUPER_ADMIN — use PUT /admin/users/{id}/admin-status for that. Regular ADMINs cannot edit ADMIN or SUPER_ADMIN users (403).",
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
    "Admin-only soft delete of the target user (status becomes DELETED). Regular ADMINs cannot delete ADMIN or SUPER_ADMIN users (403).",
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
    "403": {
      description: "Forbidden — target user is an admin/super-admin",
      content: {
        "application/json": { schema: forbiddenError },
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

const adminStatusUserSchema = userProfileSchema;

const permissionEnum = z.enum(PERMISSION_CODES).openapi("Permission");

// Grouped catalog returned by GET /admin/users/permissions — titles/labels are
// for the frontend UI to render; only `code` values are ever stored or sent back.
const permissionGroupSchema = z.object({
  title: z.string().openapi({ example: "تیم‌ها" }),
  permissions: z.array(
    z.object({
      code: permissionEnum,
      label: z.string().openapi({ example: "ایجاد تیم" }),
    }),
  ),
});

const permissionCatalogSchema = z.array(permissionGroupSchema);

const userPermissionsSchema = z.object({
  permissions: z.array(permissionEnum).openapi({ example: ["teams.create", "teams.update"] }),
});

registry.registerPath({
  method: "patch",
  path: "/admin/users/{id}/password",
  tags: ["Admin Users"],
  summary: "Reset user password",
  description:
    "Admin-only endpoint to set a new password for any user without requiring the current password. Clears the user's refresh token, forcing re-login. Regular ADMINs cannot reset passwords for ADMIN or SUPER_ADMIN users (403).",
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

const superAdminForbiddenError = errorResponseSchema(403, "Forbidden");

registry.registerPath({
  method: "put",
  path: "/admin/users/{id}/admin-status",
  tags: ["Admin Users"],
  summary: "Grant or revoke ADMIN",
  description:
    "SUPER_ADMIN-only endpoint to make a user an ADMIN or revoke ADMIN from them. Revoking ADMIN also clears the user's fine-grained permissions. SUPER_ADMIN accounts can never be revoked.",
  request: {
    params: idParamSchema,
    body: {
      content: { "application/json": { schema: setAdminStatusSchema } },
    },
  },
  responses: {
    "200": {
      description: "Admin status updated",
      content: {
        "application/json": {
          schema: successResponseSchema(adminStatusUserSchema, {
            messageExample: messages.success.auth.adminStatusUpdated,
          }),
        },
      },
    },
    "400": {
      description: "Cannot revoke ADMIN from a SUPER_ADMIN",
      content: {
        "application/json": {
          schema: errorResponseSchema(
            400,
            messages.error.auth.cannotRevokeAdminFromSuperAdmin,
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
      description: "SUPER_ADMIN role required",
      content: {
        "application/json": { schema: superAdminForbiddenError },
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
  method: "get",
  path: "/admin/users/permissions",
  tags: ["Admin Users"],
  summary: "List the permission catalog",
  description:
    "SUPER_ADMIN-only endpoint returning every permission that exists in the code, grouped by section with Persian titles and labels, for building the permission-assignment UI. Only the `code` values are ever submitted back.",
  responses: {
    "200": {
      description: "Permission catalog",
      content: {
        "application/json": {
          schema: successResponseSchema(permissionCatalogSchema, {
            messageExample: messages.success.auth.permissionCatalogFetched,
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
      description: "SUPER_ADMIN role required",
      content: {
        "application/json": { schema: superAdminForbiddenError },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/admin/users/{id}/permissions",
  tags: ["Admin Users"],
  summary: "Get a user's permissions",
  description:
    "SUPER_ADMIN-only endpoint returning the fine-grained permissions currently assigned to an ADMIN user.",
  request: {
    params: idParamSchema,
  },
  responses: {
    "200": {
      description: "User's assigned permissions",
      content: {
        "application/json": {
          schema: successResponseSchema(userPermissionsSchema, {
            messageExample: messages.success.auth.permissionsFetched,
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
      description: "SUPER_ADMIN role required",
      content: {
        "application/json": { schema: superAdminForbiddenError },
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
  path: "/admin/users/{id}/permissions",
  tags: ["Admin Users"],
  summary: "Replace a user's permissions",
  description:
    "SUPER_ADMIN-only endpoint that replaces the complete set of fine-grained permissions for an ADMIN user. The target user must already hold the ADMIN role.",
  request: {
    params: idParamSchema,
    body: {
      content: { "application/json": { schema: replacePermissionsSchema } },
    },
  },
  responses: {
    "200": {
      description: "Permissions replaced",
      content: {
        "application/json": {
          schema: successResponseSchema(userPermissionsSchema, {
            messageExample: messages.success.auth.permissionsUpdated,
          }),
        },
      },
    },
    "400": {
      description: "Target user is not an ADMIN",
      content: {
        "application/json": {
          schema: errorResponseSchema(400, messages.error.auth.userNotAdmin),
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
      description: "SUPER_ADMIN role required",
      content: {
        "application/json": { schema: superAdminForbiddenError },
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
