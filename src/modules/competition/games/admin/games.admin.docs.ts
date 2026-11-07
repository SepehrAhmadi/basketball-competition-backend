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
    teamStatus: z
      .enum(["ACTIVE", "INACTIVE", "DELETED"])
      .optional()
      .openapi({
        example: "ACTIVE",
        description: "Present only for FINISHED leagues.",
      }),
  })
  .openapi("AdminGameTeam");

const lockField = (description: string) =>
  z.union([advisorySchema, z.null()]).openapi({ example: null, description });

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
    scheduleLock: lockField(
      "Null when the schedule can be edited. Codes: `FINISHED`, " +
        "`LEAGUE_NOT_ACTIVE`, `STATUS_LOCKED`.",
    ),
    startLock: lockField(
      "Null when the game can be started (status LIVE). Codes: `FINISHED`, " +
        "`LEAGUE_NOT_ACTIVE`, `STATUS_LOCKED`.",
    ),
    cancelLock: lockField(
      "Null when the game can be canceled. Codes: `FINISHED`, " +
        "`LEAGUE_NOT_ACTIVE`, `STATUS_LOCKED`.",
    ),
    resultLock: lockField(
      "Null when a result can be entered, edited or cleared. Codes: " +
        "`FINISHED`, `LEAGUE_NOT_ACTIVE`, `STATUS_LOCKED`. Show \"clear " +
        "result\" when `status = FINISHED` and `resultLock = null`.",
    ),
    deleteLock: lockField(
      "Null when the game can be deleted. Codes: `FINISHED`, " +
        "`LEAGUE_NOT_ACTIVE`, `STATUS_LOCKED`, `HAS_REPLACEMENT`.",
    ),
    issues: z.array(advisorySchema).openapi({
      description:
        "Warnings for this game; `[]` when none. Codes: `RESULT_PENDING`, " +
        "`UNSCHEDULED`, `HOME_AWAY_NOT_SWAPPED`, `OUTSIDE_LEAGUE_PERIOD`.",
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
        "Null when games can be created (\"new game\" button). Codes: " +
        "`FINISHED`, `LEAGUE_NOT_ACTIVE`, `FORMAT_NOT_SET`, `FORMAT_NOT_GROUPED`.",
    }),
    items: z.array(adminGameSchema),
    total: z.number().openapi({ example: 12 }),
    page: z.number().openapi({ example: 1 }),
    pageSize: z.number().openapi({ example: 20 }),
    summary: z
      .object({
        byStatus: z
          .object({
            SCHEDULED: z.number().openapi({ example: 8 }),
            LIVE: z.number().openapi({ example: 0 }),
            FINISHED: z.number().openapi({ example: 12 }),
            CANCELED: z.number().openapi({ example: 1 }),
          })
          .openapi({ description: "Always contains all four statuses." }),
        resultPending: z.number().openapi({
          example: 2,
          description: "Open games (SCHEDULED/LIVE) dated before today in Tehran.",
        }),
        unfinished: z.number().openapi({
          example: 8,
          description: "SCHEDULED + LIVE games.",
        }),
        issues: z.array(advisorySchema).openapi({
          description:
            "Code `UNFINISHED_GAMES` (WARNING) when `unfinished > 0`. " +
            "Informational; never blocks finishing the league.",
        }),
      })
      .openapi("AdminGamesSummary"),
  })
  .openapi("AdminGamesList");

const unauthorizedError = errorResponseSchema(401, "Unauthorized");

function jsonError(status: number, message: string) {
  return {
    "application/json": { schema: errorResponseSchema(status, message) },
  };
}

function gameErrors(options: {
  permission: string;
  notFound: string;
  badRequest?: string;
  conflict?: string;
}) {
  return {
    ...(options.badRequest
      ? {
          "400": {
            description: options.badRequest,
            content: jsonError(400, messages.error.game.sameTeam),
          },
        }
      : {}),
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: `Missing permission: ${options.permission}`,
      content: jsonError(403, "Forbidden"),
    },
    "404": {
      description: options.notFound,
      content: jsonError(404, messages.error.game.notFound),
    },
    ...(options.conflict
      ? {
          "409": {
            description: options.conflict,
            content: jsonError(409, messages.error.game.statusLocked),
          },
        }
      : {}),
  };
}

registry.registerPath({
  method: "get",
  path: "/admin/leagues/{leagueId}/games",
  tags: ["Admin - Games"],
  summary: "List games of a league (admin)",
  description:
    "Filtered list ordered by date, time, id. Each item carries lock fields " +
    "and `issues`; `summary` covers the whole league.",
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
    ...gameErrors({ permission: "games.view", notFound: "League not found" }),
  },
});

registry.registerPath({
  method: "get",
  path: "/admin/leagues/{leagueId}/games/{gameId}",
  tags: ["Admin - Games"],
  summary: "Get a game (admin)",
  description: "Full detail with lock fields and `issues`.",
  request: { params: gameIdParamSchema },
  responses: {
    "200": {
      description: "Game fetched",
      content: {
        "application/json": {
          schema: successResponseSchema(adminGameSchema, {
            messageExample: messages.success.game.found,
          }),
        },
      },
    },
    ...gameErrors({
      permission: "games.view",
      notFound: "League or game not found",
    }),
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
    ...gameErrors({
      permission: "games.create",
      badRequest:
        "Validation error, same team, team without group, or teams in different groups",
      notFound: "League, league team or reschedule source not found",
      conflict:
        "League finished or not active, format not set or not grouped, pair " +
        "limit reached, invalid reschedule source, or already rescheduled",
    }),
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
    ...gameErrors({
      permission: "games.update",
      badRequest: "Validation error",
      notFound: "League or game not found",
      conflict: "League finished or not active, or schedule locked",
    }),
  },
});

registry.registerPath({
  method: "patch",
  path: "/admin/leagues/{leagueId}/games/{gameId}/status",
  tags: ["Admin - Games"],
  summary: "Change game status",
  description:
    "SCHEDULED to LIVE, SCHEDULED/LIVE to CANCELED. FINISHED games can " +
    "never be canceled and CANCELED games have no transitions.",
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
    ...gameErrors({
      permission: "games.update",
      badRequest: "Validation error",
      notFound: "League or game not found",
      conflict: "League finished or not active, or status locked",
    }),
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
    ...gameErrors({
      permission: "games.result",
      badRequest:
        "Validation error, invalid score, tie not allowed, or forfeit team " +
        "is not one of the game's teams",
      notFound: "League or game not found",
      conflict: "League finished or not active, or status locked",
    }),
  },
});

registry.registerPath({
  method: "delete",
  path: "/admin/leagues/{leagueId}/games/{gameId}/result",
  tags: ["Admin - Games"],
  summary: "Clear a game result",
  description:
    "Undo for a wrongly entered result: returns a FINISHED game to " +
    "SCHEDULED and clears scores, result type, forfeit team and note.",
  request: { params: gameIdParamSchema },
  responses: {
    "200": {
      description: "Result cleared",
      content: {
        "application/json": {
          schema: successResponseSchema(adminGameSchema, {
            messageExample: messages.success.game.resultCleared,
          }),
        },
      },
    },
    ...gameErrors({
      permission: "games.result",
      notFound: "League or game not found",
      conflict:
        "League finished or not active, no result to clear, or status locked",
    }),
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
    ...gameErrors({
      permission: "games.delete",
      notFound: "League or game not found",
      conflict:
        "League finished or not active, delete not allowed, or game has a replacement",
    }),
  },
});
