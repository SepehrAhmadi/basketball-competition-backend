import { z } from "zod";
import { messages } from "../../../language/message.ts";
import { registry } from "../../../swagger/registry.ts";
import {
  errorResponseSchema,
  successResponseSchema,
} from "../../../swagger/helpers.ts";
import { upsertPlayerSchema } from "./players.validation.ts";

export const playerSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    userId: z.number().openapi({ example: 10 }),
    firstName: z.string().openapi({ example: "Ali" }),
    lastName: z.string().openapi({ example: "Rezaei" }),
    birthDate: z.coerce
      .date()
      .nullable()
      .openapi({ example: "2001-05-04T00:00:00.000Z" }),
    nationalId: z.string().nullable().openapi({ example: "0012345678" }),
    photoUrl: z
      .string()
      .nullable()
      .openapi({ example: "/uploads/photos/player-1.png" }),
    height: z.number().nullable().openapi({ example: 190.5 }),
    position: z.string().nullable().openapi({ example: "SG" }),
    createdAt: z.date().openapi({ example: "2026-01-01T10:00:00.000Z" }),
  })
  .openapi("Player");

const unauthorizedError = errorResponseSchema(401, "Unauthorized");
const forbiddenError = errorResponseSchema(403, "Forbidden");

registry.registerPath({
  method: "get",
  path: "/players/me",
  tags: ["Players"],
  summary: "Get the authenticated player's own profile",
  description:
    "Returns null data when the authenticated user has not created a player profile yet.",
  request: {},
  responses: {
    "200": {
      description: "Player profile (data may be null)",
      content: {
        "application/json": {
          schema: successResponseSchema(playerSchema.nullable(), {
            messageExample: messages.success.player.found,
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
      description: "Requires the PLAYER role",
      content: {
        "application/json": { schema: forbiddenError },
      },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/players/me",
  tags: ["Players"],
  summary: "Create or update the authenticated player's own profile",
  request: {
    body: {
      content: { "application/json": { schema: upsertPlayerSchema } },
    },
  },
  responses: {
    "200": {
      description: "Player profile saved",
      content: {
        "application/json": {
          schema: successResponseSchema(playerSchema, {
            messageExample: messages.success.player.updated,
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
            `firstName: ${messages.error.auth.fullNameRequired}`,
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
      description: "Requires the PLAYER role",
      content: {
        "application/json": { schema: forbiddenError },
      },
    },
  },
});
