import { z } from "zod";
import { messages } from "../../../../language/message.ts";
import { registry } from "../../../../swagger/registry.ts";
import {
  errorResponseSchema,
  successResponseSchema,
} from "../../../../swagger/helpers.ts";
import {
  GROUP_ROUND_TYPE_VALUES,
  LEAGUE_FORMAT_VALUES,
} from "../lib/format.rules.ts";
import {
  leagueIdParamSchema,
  updateFormatSchema,
} from "./format.admin.validation.ts";

const leagueFormatValueSchema = z
  .enum(LEAGUE_FORMAT_VALUES)
  .openapi("LeagueFormatValue");

const groupRoundTypeValueSchema = z
  .enum(GROUP_ROUND_TYPE_VALUES)
  .openapi("GroupRoundTypeValue");

const leagueFormatSchema = z
  .object({
    leagueId: z.number().openapi({ example: 1 }),
    format: leagueFormatValueSchema
      .nullable()
      .openapi({ example: "GROUPS_KNOCKOUT" }),
    winPoints: z.number().openapi({ example: 2 }),
    lossPoints: z.number().openapi({ example: 1 }),
    groupRoundType: groupRoundTypeValueSchema
      .nullable()
      .openapi({ example: "ONE_ROUND" }),
    defaultQualifiersPerGroup: z
      .number()
      .nullable()
      .openapi({ example: 2 }),
    can: z.object({
      edit: z.boolean().openapi({ example: true }),
    }),
    lockReason: z
      .enum(["FINISHED", "HAS_GAMES"])
      .nullable()
      .openapi({ example: null }),
  })
  .openapi("LeagueFormat");

const unauthorizedError = errorResponseSchema(401, "Unauthorized");
const forbiddenError = errorResponseSchema(403, "Forbidden");
const badRequestError = errorResponseSchema(400, "Bad request");
const conflictError = errorResponseSchema(409, "Conflict");

registry.registerPath({
  method: "get",
  path: "/admin/leagues/{leagueId}/format",
  tags: ["Admin - League Format"],
  summary: "Get the competition format of a league (admin)",
  description:
    "`format: null` means the structure has not been configured yet. In that " +
    "case `groupRoundType` and `defaultQualifiersPerGroup` are also null, " +
    "points are the defaults (2/1), and `can.edit` is true unless the league " +
    "is FINISHED.",
  request: { params: leagueIdParamSchema },
  responses: {
    "200": {
      description: "League format fetched",
      content: {
        "application/json": {
          schema: successResponseSchema(leagueFormatSchema, {
            messageExample: messages.success.leagueFormat.found,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: leagues.view",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "League not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.league.notFound),
        },
      },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/admin/leagues/{leagueId}/format",
  tags: ["Admin - League Format"],
  summary: "Replace the competition format of a league (admin)",
  description:
    "Replaces the whole format object. `groupRoundType` and " +
    "`defaultQualifiersPerGroup` are required for group formats and ignored " +
    "(stored as null) for `KNOCKOUT_ONLY`. `winPoints`/`lossPoints` default " +
    "to 2/1. Locked when the league is FINISHED or has games. Whole-object " +
    "replace. Omitted `winPoints`/`lossPoints` reset to 2/1, so clients should " +
    "always send all fields.",
  request: {
    params: leagueIdParamSchema,
    body: {
      content: { "application/json": { schema: updateFormatSchema } },
    },
  },
  responses: {
    "200": {
      description: "League format updated",
      content: {
        "application/json": {
          schema: successResponseSchema(leagueFormatSchema, {
            messageExample: messages.success.leagueFormat.updated,
          }),
        },
      },
    },
    "400": {
      description: "Validation error",
      content: { "application/json": { schema: badRequestError } },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: leagues.update",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "League not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.league.notFound),
        },
      },
    },
    "409": {
      description: "League is FINISHED or has games",
      content: { "application/json": { schema: conflictError } },
    },
  },
});
