import { z } from "zod";
import { messages } from "../../../../language/message.ts";
import { registry } from "../../../../swagger/registry.ts";
import {
  errorResponseSchema,
  successResponseSchema,
} from "../../../../swagger/helpers.ts";
import { advisorySchema } from "../../../../swagger/advisory.docs.ts";
import {
  createGameSchema,
  enterGameResultSchema,
  gameIdParamSchema,
  leagueIdParamSchema,
  publicGamesQuerySchema,
  updateGameScheduleSchema,
  updateGameStatusSchema,
} from "./games.admin.validation.ts";

const adminGameTeamSchema = z
  .object({
    leagueTeamId: z.number().openapi({ example: 11 }),
    team: z.object({
      id: z.number().openapi({ example: 5 }),
      name: z.string().openapi({ example: "عقاب" }),
      logoUrl: z.string().nullable().openapi({ example: null }),
    }),
    organization: z
      .object({
        id: z.number().openapi({ example: 2 }),
        name: z.string().openapi({ example: "باشگاه عقاب" }),
      })
      .nullable(),
  })
  .openapi("AdminGameTeam");

const adminGameCanSchema = z
  .object({
    editSchedule: z.boolean().openapi({ example: true }),
    enterResult: z.boolean().openapi({ example: true }),
    cancel: z.boolean().openapi({ example: true }),
    delete: z.boolean().openapi({ example: false }),
  })
  .openapi("AdminGameCan");

const adminGameSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    status: z.string().openapi({ example: "SCHEDULED" }),
    resultType: z.string().nullable().openapi({ example: null }),
    group: z
      .object({
        id: z.number().openapi({ example: 3 }),
        name: z.string().openapi({ example: "گروه الف" }),
      })
      .nullable(),
    homeTeam: adminGameTeamSchema,
    awayTeam: adminGameTeamSchema,
    scheduledDate: z.string().nullable().openapi({ example: "1405/08/16" }),
    scheduledTime: z.string().nullable().openapi({ example: "17:00" }),
    homeScore: z.number().nullable().openapi({ example: null }),
    awayScore: z.number().nullable().openapi({ example: null }),
    winnerLeagueTeamId: z.number().nullable().openapi({ example: null }),
    forfeitLeagueTeamId: z.number().nullable().openapi({ example: null }),
    resultNote: z.string().nullable().openapi({ example: null }),
    cancelReason: z.string().nullable().openapi({ example: null }),
    rescheduledFrom: z
      .object({
        id: z.number().openapi({ example: 7 }),
        status: z.string().openapi({ example: "CANCELED" }),
      })
      .nullable(),
    rescheduledTo: z
      .object({
        id: z.number().openapi({ example: 9 }),
        status: z.string().openapi({ example: "SCHEDULED" }),
      })
      .nullable(),
    can: adminGameCanSchema,
    issues: z.array(advisorySchema).openapi({
      description:
        "Warnings for this game. Codes: `RESULT_PENDING`, `UNSCHEDULED`, " +
        "`HOME_AWAY_NOT_SWAPPED`, `OUTSIDE_LEAGUE_PERIOD`.",
    }),
  })
  .openapi("AdminGame");

const adminGamesListSchema = z
  .object({
    league: z.object({
      id: z.number().openapi({ example: 1 }),
      format: z.string().nullable().openapi({ example: "GROUPS_KNOCKOUT" }),
    }),
    lock: z.union([advisorySchema, z.null()]).openapi({
      example: null,
      description:
        "Null when games can be created. Codes: `FINISHED`, " +
        "`LEAGUE_NOT_ACTIVE`, `FORMAT_NOT_SET`, `FORMAT_NOT_GROUPED`.",
    }),
    items: z.array(adminGameSchema),
    total: z.number().openapi({ example: 12 }),
    page: z.number().openapi({ example: 1 }),
    pageSize: z.number().openapi({ example: 20 }),
    summary: z
      .object({
        byStatus: z.record(z.number()).openapi({ example: { SCHEDULED: 8 } }),
        resultPending: z.number().openapi({ example: 2 }),
        unfinishedAtFinish: z.number().openapi({ example: 2 }),
      })
      .openapi("AdminGamesSummary"),
  })
  .openapi("AdminGamesList");

const adminGameDetailSchema = adminGameSchema
  .extend({
    lock: z.union([advisorySchema, z.null()]).openapi({ example: null }),
  })
  .openapi("AdminGameDetail");

function gameErrorResponses() {
  return {
    "404": {
      description: "Game not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.game.notFound),
        },
      },
    },
    "409": {
      description: "Business rule violation",
      content: {
        "application/json": {
          schema: errorResponseSchema(409, messages.error.game.pairLimitReached),
        },
      },
    },
  };
}

registry.registerPath({
  method: "get",
  path: "/admin/leagues/{leagueId}/games",
  tags: ["Admin - Games"],
  summary: "List games of a league (admin)",
  description: "Filtered list with per-item `can` and `issues` plus summary.",
  request: { params: leagueIdParamSchema, query: publicGamesQuerySchema },
  responses: {
    "200": {
      description: "Games fetched",
      content: {
        "application/json": {
          schema: successResponseSchema(adminGamesListSchema, {
            messageExample: messages.success.game.list,
          }),
        },
      },
    },
    ...gameErrorResponses(),
  },
});

registry.registerPath({
  method: "get",
  path: "/admin/leagues/{leagueId}/games/{gameId}",
  tags: ["Admin - Games"],
  summary: "Get a game (admin)",
  description: "Full detail for the edit screen with `can`, `issues`, `lock`.",
  request: { params: gameIdParamSchema },
  responses: {
    "200": {
      description: "Game fetched",
      content: {
        "application/json": {
          schema: successResponseSchema(adminGameDetailSchema, {
            messageExample: messages.success.game.found,
          }),
        },
      },
    },
    ...gameErrorResponses(),
  },
});

registry.registerPath({
  method: "post",
  path: "/admin/leagues/{leagueId}/games",
  tags: ["Admin - Games"],
  summary: "Create a group-stage game",
  description:
    "Teams must share a group; pair quota and reschedule source are enforced.",
  request: {
    params: leagueIdParamSchema,
    body: { content: { "application/json": { schema: createGameSchema } } },
  },
  responses: {
    "201": {
      description: "Game created",
      content: {
        "application/json": {
          schema: successResponseSchema(adminGameSchema, {
            statusCode: 201,
            messageExample: messages.success.game.created,
          }),
        },
      },
    },
    ...gameErrorResponses(),
  },
});

registry.registerPath({
  method: "put",
  path: "/admin/leagues/{leagueId}/games/{gameId}",
  tags: ["Admin - Games"],
  summary: "Update game schedule",
  description: "Date and time must be set or cleared together.",
  request: {
    params: gameIdParamSchema,
    body: { content: { "application/json": { schema: updateGameScheduleSchema } } },
  },
  responses: {
    "200": {
      description: "Schedule updated",
      content: {
        "application/json": {
          schema: successResponseSchema(adminGameSchema, {
            messageExample: messages.success.game.updated,
          }),
        },
      },
    },
    ...gameErrorResponses(),
  },
});

registry.registerPath({
  method: "patch",
  path: "/admin/leagues/{leagueId}/games/{gameId}/status",
  tags: ["Admin - Games"],
  summary: "Change game status",
  description:
    "SCHEDULED/LIVE to LIVE/CANCELED, or FINISHED back to CANCELED (clears result).",
  request: {
    params: gameIdParamSchema,
    body: { content: { "application/json": { schema: updateGameStatusSchema } } },
  },
  responses: {
    "200": {
      description: "Status updated",
      content: {
        "application/json": {
          schema: successResponseSchema(adminGameSchema, {
            messageExample: messages.success.game.statusUpdated,
          }),
        },
      },
    },
    ...gameErrorResponses(),
  },
});

registry.registerPath({
  method: "put",
  path: "/admin/leagues/{leagueId}/games/{gameId}/result",
  tags: ["Admin - Games"],
  summary: "Enter or edit game result",
  description:
    "NORMAL with scores or FORFEIT with the forfeiting team; server writes 0/20.",
  request: {
    params: gameIdParamSchema,
    body: { content: { "application/json": { schema: enterGameResultSchema } } },
  },
  responses: {
    "200": {
      description: "Result saved",
      content: {
        "application/json": {
          schema: successResponseSchema(adminGameSchema, {
            messageExample: messages.success.game.resultSaved,
          }),
        },
      },
    },
    ...gameErrorResponses(),
  },
});

registry.registerPath({
  method: "delete",
  path: "/admin/leagues/{leagueId}/games/{gameId}",
  tags: ["Admin - Games"],
  summary: "Delete a game",
  description: "Only SCHEDULED or CANCELED games without a replacement.",
  request: { params: gameIdParamSchema },
  responses: {
    "200": {
      description: "Game deleted",
      content: {
        "application/json": {
          schema: successResponseSchema(
            z.object({ id: z.number().openapi({ example: 1 }) }),
            { messageExample: messages.success.game.deleted },
          ),
        },
      },
    },
    ...gameErrorResponses(),
  },
});
