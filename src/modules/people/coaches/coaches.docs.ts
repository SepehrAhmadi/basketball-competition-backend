import { z } from "zod";
import { messages } from "../../../language/message.ts";
import { registry } from "../../../swagger/registry.ts";
import {
  errorResponseSchema,
  successResponseSchema,
} from "../../../swagger/helpers.ts";
import { coachDegreeEnum, upsertCoachSchema } from "./coaches.validation.ts";

export const coachSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    userId: z.number().openapi({ example: 11 }),
    photoUrl: z
      .string()
      .nullable()
      .openapi({ example: "/uploads/photos/coach-1.png" }),
    degree: coachDegreeEnum.openapi("CoachDegree").openapi({ example: "LEVEL_2" }),
    createdAt: z.date().openapi({ example: "2026-01-01T10:00:00.000Z" }),
  })
  .openapi("Coach");

const unauthorizedError = errorResponseSchema(401, "Unauthorized");
const forbiddenError = errorResponseSchema(403, "Forbidden");

registry.registerPath({
  method: "get",
  path: "/coaches/me",
  tags: ["Coaches"],
  summary: "Get the authenticated coach's own profile",
  description:
    "Returns null data when the authenticated user has not created a coach profile yet.",
  request: {},
  responses: {
    "200": {
      description: "Coach profile (data may be null)",
      content: {
        "application/json": {
          schema: successResponseSchema(coachSchema.nullable(), {
            messageExample: messages.success.coach.found,
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
      description: "Requires the COACH role",
      content: {
        "application/json": { schema: forbiddenError },
      },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/coaches/me",
  tags: ["Coaches"],
  summary: "Create or update the authenticated coach's own profile",
  request: {
    body: {
      content: { "application/json": { schema: upsertCoachSchema } },
    },
  },
  responses: {
    "200": {
      description: "Coach profile saved",
      content: {
        "application/json": {
          schema: successResponseSchema(coachSchema, {
            messageExample: messages.success.coach.updated,
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
            "degree: Invalid enum value. Expected 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'NATIONAL', received 'GOLD'",
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
      description: "Requires the COACH role",
      content: {
        "application/json": { schema: forbiddenError },
      },
    },
  },
});
