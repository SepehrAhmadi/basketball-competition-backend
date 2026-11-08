import { z } from "zod";
import { messages } from "../../../language/message.ts";
import { registry } from "../../../swagger/registry.ts";
import {
  errorResponseSchema,
  successResponseSchema,
} from "../../../swagger/helpers.ts";
import {
  gameIdParamSchema,
  leagueIdParamSchema,
  gamesListQuerySchema,
} from "./games.validation.ts";

const publicNote =
  "Public endpoint. A Bearer token is optional. Ordered by `scheduledDate`, " +
  "`scheduledTime`, `id` ascending (unscheduled games first).";

export const publicGameTeamSchema = z
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
  .openapi("PublicGameTeam");

export const publicGameSchema = z
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
    homeTeam: publicGameTeamSchema,
    awayTeam: publicGameTeamSchema,
    scheduledDate: z.string().nullable().openapi({ example: "1405/08/16" }),
    scheduledTime: z.string().nullable().openapi({ example: "17:00" }),
    homeScore: z.number().nullable().openapi({ example: null }),
    awayScore: z.number().nullable().openapi({ example: null }),
    winnerLeagueTeamId: z.number().nullable().openapi({ example: null }),
    forfeitLeagueTeamId: z.number().nullable().openapi({ example: null }),

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
  })
  .openapi("PublicGame");

const publicGamesListSchema = z
  .object({
    format: z.string().nullable().openapi({ example: "GROUPS_KNOCKOUT" }),
    items: z.array(publicGameSchema),
    total: z.number().openapi({ example: 12 }),
    page: z.number().openapi({ example: 1 }),
    pageSize: z.number().openapi({ example: 20 }),
  })
  .openapi("PublicGamesList");

registry.registerPath({
  method: "get",
  path: "/leagues/{leagueId}/games",
  tags: ["League Games"],
  summary: "List games of a league (public)",
  description:
    "Group-stage games of a grouped league. Empty when the format is not grouped. " +
    publicNote,
  security: [],
  request: { params: leagueIdParamSchema, query: gamesListQuerySchema },
  responses: {
    "200": {
      description: "Games fetched",
      content: {
        "application/json": {
          schema: successResponseSchema(publicGamesListSchema, {
            messageExample: messages.success.game.list,
          }),
        },
      },
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
  method: "get",
  path: "/leagues/{leagueId}/games/{gameId}",
  tags: ["League Games"],
  summary: "Get a game (public)",
  description: "Full game detail including reschedule links. " + publicNote,
  security: [],
  request: { params: gameIdParamSchema },
  responses: {
    "200": {
      description: "Game fetched",
      content: {
        "application/json": {
          schema: successResponseSchema(publicGameSchema, {
            messageExample: messages.success.game.found,
          }),
        },
      },
    },
    "404": {
      description: "Game not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.game.notFound),
        },
      },
    },
  },
});
