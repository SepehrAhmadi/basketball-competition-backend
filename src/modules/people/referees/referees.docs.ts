import { z } from "zod";
import { messages } from "../../../language/message.ts";
import { registry } from "../../../swagger/registry.ts";
import {
  errorResponseSchema,
  successResponseSchema,
} from "../../../swagger/helpers.ts";
import { upsertRefereeSchema } from "./referees.validation.ts";

export const refereeSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    userId: z.number().openapi({ example: 12 }),
    licenseLevel: z.string().nullable().openapi({ example: "INTERNATIONAL" }),
    photoUrl: z
      .string()
      .nullable()
      .openapi({ example: "/uploads/photos/referee-1.png" }),
    createdAt: z.date().openapi({ example: "2026-01-01T10:00:00.000Z" }),
  })
  .openapi("Referee");

const unauthorizedError = errorResponseSchema(401, "Unauthorized");
const forbiddenError = errorResponseSchema(403, "Forbidden");

registry.registerPath({
  method: "get",
  path: "/referees/me",
  tags: ["Referees"],
  summary: "Get the authenticated referee's own profile",
  description:
    "Returns null data when the authenticated user has not created a referee profile yet.",
  request: {},
  responses: {
    "200": {
      description: "Referee profile (data may be null)",
      content: {
        "application/json": {
          schema: successResponseSchema(refereeSchema.nullable(), {
            messageExample: messages.success.referee.found,
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
      description: "Requires the REFEREE role",
      content: {
        "application/json": { schema: forbiddenError },
      },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/referees/me",
  tags: ["Referees"],
  summary: "Create or update the authenticated referee's own profile",
  request: {
    body: {
      content: { "application/json": { schema: upsertRefereeSchema } },
    },
  },
  responses: {
    "200": {
      description: "Referee profile saved",
      content: {
        "application/json": {
          schema: successResponseSchema(refereeSchema, {
            messageExample: messages.success.referee.updated,
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
            "licenseLevel: Expected string, received number",
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
      description: "Requires the REFEREE role",
      content: {
        "application/json": { schema: forbiddenError },
      },
    },
  },
});
