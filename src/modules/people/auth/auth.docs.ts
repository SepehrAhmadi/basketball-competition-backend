import { z } from "zod";
import { messages } from "../../../language/message.ts";
import { registry } from "../../../swagger/registry.ts";
import {
  errorResponseSchema,
  successResponseSchema,
} from "../../../swagger/helpers.ts";
import { idParamSchema } from "../../../shared/schemas.validation.ts";
import {
  registerSchema,
  loginSchema,
  adminCreateUserSchema,
} from "./auth.validation.ts";

// ---- response models ----
const roleEnum = z.enum([
  "ADMIN",
  "ORG_MANAGER",
  "COACH",
  "PLAYER",
  "REFEREE",
  "PUBLIC",
]).openapi("Role");

const userInfoSchema = z
  .object({
    id: z.number().openapi({ example: 10 }),
    fullName: z.string().openapi({ example: "Ali Rezaei" }),
    roles: z.array(roleEnum).openapi({ example: ["PLAYER"] }),
  })
  .openapi("UserInfo");

const createdUserSchema = z.object({
  id: z.number().openapi({ example: 10 }),
});

const accessTokenDataSchema = z.object({
  accessToken: z.string().openapi({
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwfQ.x",
  }),
});

const loginDataSchema = z.object({
  accessToken: z.string().openapi({
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwfQ.x",
  }),
  user: userInfoSchema,
});

const unauthorizedError = errorResponseSchema(401, "Unauthorized");
const forbiddenError = errorResponseSchema(403, "Forbidden");

// ---- path registrations ----
registry.registerPath({
  method: "post",
  path: "/auth/register",
  tags: ["Auth"],
  summary: "Self-register a new account",
  description:
    "Creates a user account with one or more self-service roles. Returns the new user's id.",
  security: [],
  request: {
    body: { content: { "application/json": { schema: registerSchema } } },
  },
  responses: {
    "201": {
      description: "Account created",
      content: {
        "application/json": {
          schema: successResponseSchema(createdUserSchema, {
            statusCode: 201,
            messageExample: messages.success.auth.accountCreated,
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
    "409": {
      description: "Phone number or email already registered",
      content: {
        "application/json": {
          schema: errorResponseSchema(
            409,
            messages.error.auth.phoneOrEmailInUse,
          ),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/login",
  tags: ["Auth"],
  summary: "Log in",
  description:
    "Authenticates with phone/email + password. Sets the refresh token as an httpOnly cookie (`jwt`) and returns an access token.",
  security: [],
  request: {
    body: { content: { "application/json": { schema: loginSchema } } },
  },
  responses: {
    "200": {
      description: "Logged in",
      content: {
        "application/json": {
          schema: successResponseSchema(loginDataSchema, {
            messageExample: messages.success.auth.loginSuccessful,
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
            `identifier: ${messages.error.auth.identifierRequired}`,
          ),
        },
      },
    },
    "401": {
      description: "Invalid credentials",
      content: {
        "application/json": {
          schema: errorResponseSchema(
            401,
            messages.error.auth.invalidCredentials,
          ),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/admin/login",
  tags: ["Auth"],
  summary: "Log in to the admin panel",
  description:
    "Same credentials as /auth/login but requires the ADMIN role. Sets the refresh token as an httpOnly cookie (`jwt`).",
  security: [],
  request: {
    body: { content: { "application/json": { schema: loginSchema } } },
  },
  responses: {
    "200": {
      description: "Logged in",
      content: {
        "application/json": {
          schema: successResponseSchema(loginDataSchema, {
            messageExample: messages.success.auth.loginSuccessful,
          }),
        },
      },
    },
    "401": {
      description: "Invalid credentials",
      content: {
        "application/json": {
          schema: errorResponseSchema(
            401,
            messages.error.auth.invalidCredentials,
          ),
        },
      },
    },
    "403": {
      description: "Account is not allowed on the admin panel",
      content: {
        "application/json": {
          schema: errorResponseSchema(
            403,
            messages.error.auth.notAuthorizedAdminPanel,
          ),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/refresh-token",
  tags: ["Auth"],
  summary: "Refresh the access token",
  description:
    "Uses the httpOnly refresh-token cookie (`jwt`) set at login. No request body.",
  security: [],
  request: {},
  responses: {
    "200": {
      description: "New access token issued",
      content: {
        "application/json": {
          schema: successResponseSchema(accessTokenDataSchema, {
            messageExample: messages.success.auth.tokenRefreshed,
          }),
        },
      },
    },
    "401": {
      description: "No refresh token cookie",
      content: {
        "application/json": {
          schema: errorResponseSchema(
            401,
            messages.error.auth.refreshTokenNotFound,
          ),
        },
      },
    },
    "403": {
      description: "Invalid refresh token",
      content: {
        "application/json": {
          schema: errorResponseSchema(
            403,
            messages.error.auth.invalidRefreshToken,
          ),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/logout",
  tags: ["Auth"],
  summary: "Log out",
  description:
    "Invalidates the stored refresh token and clears the httpOnly cookie.",
  security: [],
  request: {},
  responses: {
    "200": {
      description: "Logged out",
      content: {
        "application/json": {
          schema: successResponseSchema(z.null(), {
            messageExample: messages.success.auth.loggedOut,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/auth/account",
  tags: ["Auth"],
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
            messageExample: messages.success.auth.accountDeleted,
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

registry.registerPath({
  method: "post",
  path: "/auth/admin/users",
  tags: ["Auth"],
  summary: "Create a user as ADMIN",
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
        "application/json": {
          schema: errorResponseSchema(
            409,
            messages.error.auth.phoneOrEmailInUse,
          ),
        },
      },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/auth/admin/users/{id}",
  tags: ["Auth"],
  summary: "Delete a user as ADMIN",
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
          schema: errorResponseSchema(404, messages.error.auth.userNotFound),
        },
      },
    },
  },
});
