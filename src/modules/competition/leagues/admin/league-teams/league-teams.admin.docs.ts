import { z } from "zod";
import { messages } from "../../../../../language/message.ts";
import { registry } from "../../../../../swagger/registry.ts";
import {
  errorResponseSchema,
  successResponseSchema,
} from "../../../../../swagger/helpers.ts";
import {
  leagueIdParamSchema,
  leagueTeamParamSchema,
  leagueMemberParamSchema,
  registerTeamSchema,
  addMembersSchema,
  leagueTeamsQuerySchema,
  membersQuerySchema,
  candidatesQuerySchema,
  eligibleTeamsQuerySchema,
} from "./league-teams.admin.validation.ts";
import {
  eligibleTeamSchema as baseEligibleTeamSchema,
  leagueCandidateSchema as baseLeagueCandidateSchema,
  leagueMemberSchema as baseLeagueMemberSchema,
  leagueTeamItemSchema,
} from "../../leagues.docs.ts";

const leagueTeamSchema = leagueTeamItemSchema
  .omit({ can: true })
  .openapi("AdminLeagueTeam");

const leagueTeamListDataSchema = z.object({
  items: z.array(leagueTeamSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

const eligibleTeamSchema = baseEligibleTeamSchema
  .extend({})
  .openapi("AdminEligibleTeam");

const eligibleTeamListDataSchema = z.object({
  items: z.array(eligibleTeamSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

const memberSchema = baseLeagueMemberSchema
  .extend({
    phone: z.string().openapi({ example: "09123456789" }),
    birthDate: z.string().nullable().openapi({ example: "1390/05/12" }),
  })
  .openapi("AdminLeagueMember");

const memberListDataSchema = z.object({
  items: z.array(memberSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

const candidateSchema = baseLeagueCandidateSchema
  .extend({
    phone: z.string().openapi({ example: "09123456789" }),
    birthDate: z.string().nullable().openapi({ example: "1390/05/12" }),
  })
  .openapi("AdminLeagueCandidate");

const candidateListDataSchema = z.object({
  items: z.array(candidateSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

const unauthorizedError = errorResponseSchema(401, "Unauthorized");
const forbiddenError = errorResponseSchema(403, "Forbidden");
const badRequestError = errorResponseSchema(400, "Bad request");
const conflictError = errorResponseSchema(409, "Conflict");
const leagueTeamNotFound = errorResponseSchema(
  404,
  messages.error.leagueTeam.notFound,
);

registry.registerPath({
  method: "get",
  path: "/admin/leagues/{leagueId}/eligible-teams",
  tags: ["Admin - League Teams"],
  summary: "List teams eligible for registration (admin)",
  request: { params: leagueIdParamSchema, query: eligibleTeamsQuerySchema },
  responses: {
    "200": {
      description: "Eligible teams fetched",
      content: {
        "application/json": {
          schema: successResponseSchema(eligibleTeamListDataSchema, {
            messageExample: messages.success.leagueTeam.eligibleList,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: league-teams.create",
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
  method: "get",
  path: "/admin/leagues/{leagueId}/teams",
  tags: ["Admin - League Teams"],
  summary: "List registered teams (admin)",
  request: { params: leagueIdParamSchema, query: leagueTeamsQuerySchema },
  responses: {
    "200": {
      description: "League teams fetched",
      content: {
        "application/json": {
          schema: successResponseSchema(leagueTeamListDataSchema, {
            messageExample: messages.success.leagueTeam.list,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: league-teams.view",
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
  method: "post",
  path: "/admin/leagues/{leagueId}/teams",
  tags: ["Admin - League Teams"],
  summary: "Register a team (admin)",
  request: {
    params: leagueIdParamSchema,
    body: {
      content: { "application/json": { schema: registerTeamSchema } },
    },
  },
  responses: {
    "201": {
      description: "Team registered",
      content: {
        "application/json": {
          schema: successResponseSchema(leagueTeamSchema, {
            statusCode: 201,
            messageExample: messages.success.leagueTeam.registered,
          }),
        },
      },
    },
    "400": {
      description: "Team not active or without season roster",
      content: { "application/json": { schema: badRequestError } },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: league-teams.create",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "League or team not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.league.notFound),
        },
      },
    },
    "409": {
      description: "Already registered, registration closed, or unregister from ACTIVE league forbidden",
      content: { "application/json": { schema: conflictError } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/admin/leagues/{leagueId}/teams/{leagueTeamId}",
  tags: ["Admin - League Teams"],
  summary: "Withdraw a team (admin)",
  request: { params: leagueTeamParamSchema },
  responses: {
    "200": {
      description: "Team removed",
      content: {
        "application/json": {
          schema: successResponseSchema(z.null(), {
            messageExample: messages.success.leagueTeam.removed,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: league-teams.delete",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Team not found in this league",
      content: { "application/json": { schema: leagueTeamNotFound } },
    },
    "409": {
      description: "Unregister from ACTIVE league forbidden",
      content: { "application/json": { schema: conflictError } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/admin/leagues/{leagueId}/teams/{leagueTeamId}/members",
  tags: ["Admin - League Teams"],
  summary: "List league roster (admin, includes phone and birth date)",
  request: { params: leagueTeamParamSchema, query: membersQuerySchema },
  responses: {
    "200": {
      description: "League roster fetched",
      content: {
        "application/json": {
          schema: successResponseSchema(memberListDataSchema, {
            messageExample: messages.success.leagueRoster.list,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: league-roster.view",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Team not found in this league",
      content: { "application/json": { schema: leagueTeamNotFound } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/admin/leagues/{leagueId}/teams/{leagueTeamId}/members/candidates",
  tags: ["Admin - League Teams"],
  summary: "List roster candidates (admin)",
  request: { params: leagueTeamParamSchema, query: candidatesQuerySchema },
  responses: {
    "200": {
      description: "Candidates fetched",
      content: {
        "application/json": {
          schema: successResponseSchema(candidateListDataSchema, {
            messageExample: messages.success.leagueRoster.candidates,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: league-roster.view",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Team not found in this league",
      content: { "application/json": { schema: leagueTeamNotFound } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/admin/leagues/{leagueId}/teams/{leagueTeamId}/members",
  tags: ["Admin - League Teams"],
  summary: "Add members to league roster (admin)",
  request: {
    params: leagueTeamParamSchema,
    body: {
      content: { "application/json": { schema: addMembersSchema } },
    },
  },
  responses: {
    "201": {
      description: "Members added",
      content: {
        "application/json": {
          schema: successResponseSchema(z.array(memberSchema), {
            statusCode: 201,
            messageExample: messages.success.leagueRoster.added,
          }),
        },
      },
    },
    "400": {
      description: "Age ineligible or birth date missing",
      content: { "application/json": { schema: badRequestError } },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: league-roster.create",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Team or member not found",
      content: { "application/json": { schema: leagueTeamNotFound } },
    },
    "409": {
      description: "Already in roster or player in another team",
      content: { "application/json": { schema: conflictError } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/admin/leagues/{leagueId}/teams/{leagueTeamId}/members/{memberId}",
  tags: ["Admin - League Teams"],
  summary: "Remove a member from league roster (admin)",
  request: { params: leagueMemberParamSchema },
  responses: {
    "200": {
      description: "Member removed",
      content: {
        "application/json": {
          schema: successResponseSchema(z.null(), {
            messageExample: messages.success.leagueRoster.removed,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: league-roster.delete",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Roster member not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(
            404,
            messages.error.leagueRoster.notFound,
          ),
        },
      },
    },
    "409": {
      description: "Registration closed or removing the last player of a team in an ACTIVE league",
      content: { "application/json": { schema: conflictError } },
    },
  },
});

