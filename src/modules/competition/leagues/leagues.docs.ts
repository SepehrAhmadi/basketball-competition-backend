import { z } from "zod";
import { messages } from "../../../language/message.ts";
import { registry } from "../../../swagger/registry.ts";
import {
  errorResponseSchema,
  successResponseSchema,
} from "../../../swagger/helpers.ts";
import {
  leagueIdParamSchema,
  leagueTeamParamSchema,
  leagueMemberParamSchema,
  registerTeamSchema,
  addMembersSchema,
  publicLeagueListQuerySchema,
  myLeaguesQuerySchema,
  leagueTeamsQuerySchema,
  membersQuerySchema,
  candidatesQuerySchema,
  eligibleTeamsQuerySchema,
} from "./leagues.validation.ts";

const leagueCanSchema = z
  .object({
    view: z.boolean().openapi({ example: true }),
    registerTeam: z.boolean().openapi({ example: false }),
  })
  .openapi("LeagueCan");

const leagueTeamCanSchema = z
  .object({
    manageRoster: z.boolean().openapi({ example: false }),
    unregister: z.boolean().openapi({ example: false }),
  })
  .openapi("LeagueTeamCan");

const leagueSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    name: z.string().openapi({ example: "لیگ برتر نوجوانان" }),
    description: z.string().nullable().openapi({ example: null }),
    status: z.string().openapi({ example: "REGISTRATION" }),
    startDate: z.string().nullable().openapi({ example: "1404/06/01" }),
    endDate: z.string().nullable().openapi({ example: "1404/09/01" }),
    rosterDeadline: z.string().nullable().openapi({ example: "1404/05/20" }),
    ageCategoryCutoffId: z.number().openapi({ example: 1 }),
    ageCategory: z.object({
      id: z.number().openapi({ example: 1 }),
      name: z.string().openapi({ example: "نوجوانان" }),
    }),
    season: z.object({
      id: z.number().openapi({ example: 1 }),
      name: z.string().openapi({ example: "فصل ۱۴۰۴" }),
    }),
    minBirthDate: z.string().nullable().openapi({ example: "1390/10/11" }),
    teamsCount: z.number().openapi({ example: 4 }),
    createdAt: z.string(),
    updatedAt: z.string(),
    can: leagueCanSchema.optional(),
  })
  .openapi("League");

const leagueListDataSchema = z.object({
  items: z.array(leagueSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

const leagueTeamItemSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    status: z.string().openapi({ example: "ACTIVE" }),
    team: z.object({
      id: z.number().openapi({ example: 1 }),
      name: z.string().openapi({ example: "عقاب" }),
      logoUrl: z.string().nullable().openapi({ example: null }),
    }),
    organization: z.object({
      id: z.number().openapi({ example: 1 }),
      name: z.string().openapi({ example: "باشگاه عقاب" }),
    }),
    membersCount: z.number().openapi({ example: 5 }),
    createdAt: z.string(),
    can: leagueTeamCanSchema.optional(),
  })
  .openapi("LeagueTeamItem");

const leagueTeamListDataSchema = z.object({
  items: z.array(leagueTeamItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

const leagueMemberSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    teamSeasonMemberId: z.number().openapi({ example: 3 }),
    userId: z.number().openapi({ example: 7 }),
    fullName: z.string().openapi({ example: "علی رضایی" }),
    avatarUrl: z.string().nullable().openapi({ example: null }),
    role: z.string().openapi({ example: "PLAYER" }),
    jerseyNumber: z.number().nullable().openapi({ example: 10 }),
    isHeadCoach: z.boolean().openapi({ example: false }),
  })
  .openapi("LeagueMember");

const leagueMemberListDataSchema = z.object({
  items: z.array(leagueMemberSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  can: leagueTeamCanSchema.optional(),
});

const leagueCandidateSchema = leagueMemberSchema
  .extend({
    selected: z.boolean().openapi({ example: false }),
    eligible: z.boolean().openapi({ example: true }),
    ineligibleReason: z
      .string()
      .nullable()
      .openapi({ example: null }),
  })
  .openapi("LeagueCandidate");

const leagueCandidateListDataSchema = z.object({
  items: z.array(leagueCandidateSchema),
  total: z.number(),
});

const eligibleTeamSchema = z
  .object({
    team: z.object({
      id: z.number().openapi({ example: 1 }),
      name: z.string().openapi({ example: "عقاب" }),
      logoUrl: z.string().nullable().openapi({ example: null }),
    }),
    organization: z.object({
      id: z.number().openapi({ example: 1 }),
      name: z.string().openapi({ example: "باشگاه عقاب" }),
    }),
    activeRosterCount: z.number().openapi({ example: 8 }),
    alreadyRegistered: z.boolean().openapi({ example: false }),
  })
  .openapi("EligibleTeam");

const eligibleTeamListDataSchema = z.object({
  items: z.array(eligibleTeamSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

const myLeagueSchema = z
  .object({
    league: leagueSchema,
    myTeams: z.array(
      z.object({
        leagueTeamId: z.number().openapi({ example: 1 }),
        team: z.object({
          id: z.number().openapi({ example: 1 }),
          name: z.string().openapi({ example: "عقاب" }),
          logoUrl: z.string().nullable().openapi({ example: null }),
        }),
        organization: z.object({
          id: z.number().openapi({ example: 1 }),
          name: z.string().openapi({ example: "باشگاه عقاب" }),
        }),
        roles: z.array(z.string()).openapi({ example: ["MANAGER"] }),
        can: leagueTeamCanSchema,
      }),
    ),
  })
  .openapi("MyLeague");

const myLeagueListDataSchema = z.object({
  items: z.array(myLeagueSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

const unauthorizedError = errorResponseSchema(401, "Unauthorized");
const forbiddenError = errorResponseSchema(403, "Forbidden");
const badRequestError = errorResponseSchema(400, "Bad request");
const conflictError = errorResponseSchema(409, "Conflict");
const publicNote =
  "Public endpoint. A Bearer token is optional and adds `can` flags.";

registry.registerPath({
  method: "get",
  path: "/leagues",
  tags: ["Leagues"],
  summary: "List public leagues",
  description: publicNote,
  security: [],
  request: { query: publicLeagueListQuerySchema },
  responses: {
    "200": {
      description: "Leagues fetched",
      content: {
        "application/json": {
          schema: successResponseSchema(leagueListDataSchema, {
            messageExample: messages.success.league.list,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/leagues/{leagueId}",
  tags: ["Leagues"],
  summary: "Get a public league",
  description: publicNote,
  security: [],
  request: { params: leagueIdParamSchema },
  responses: {
    "200": {
      description: "League found",
      content: {
        "application/json": {
          schema: successResponseSchema(leagueSchema, {
            messageExample: messages.success.league.found,
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
  path: "/leagues/{leagueId}/teams",
  tags: ["Leagues"],
  summary: "List registered teams (public)",
  description: publicNote,
  security: [],
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
  path: "/leagues/{leagueId}/teams/{leagueTeamId}/members",
  tags: ["Leagues"],
  summary: "List league roster (public, safe fields only)",
  description: publicNote,
  security: [],
  request: { params: leagueTeamParamSchema, query: membersQuerySchema },
  responses: {
    "200": {
      description: "League roster fetched",
      content: {
        "application/json": {
          schema: successResponseSchema(leagueMemberListDataSchema, {
            messageExample: messages.success.leagueRoster.list,
          }),
        },
      },
    },
    "404": {
      description: "League or team not found",
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
  path: "/leagues/me",
  tags: ["Leagues"],
  summary: "List my leagues",
  request: { query: myLeaguesQuerySchema },
  responses: {
    "200": {
      description: "My leagues fetched",
      content: {
        "application/json": {
          schema: successResponseSchema(myLeagueListDataSchema, {
            messageExample: messages.success.league.myList,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/leagues/{leagueId}/eligible-teams",
  tags: ["Leagues"],
  summary: "List my teams eligible for registration",
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
  path: "/leagues/{leagueId}/teams",
  tags: ["Leagues"],
  summary: "Register a team (manager)",
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
          schema: successResponseSchema(leagueTeamItemSchema, {
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
      description: "Not the manager of the team organization",
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
      description: "Already registered or registration closed",
      content: { "application/json": { schema: conflictError } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/leagues/{leagueId}/teams/{leagueTeamId}",
  tags: ["Leagues"],
  summary: "Withdraw a team (manager)",
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
      description: "Not the manager of the team organization",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Team not found in this league",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.leagueTeam.notFound),
        },
      },
    },
    "409": {
      description: "Registration closed",
      content: { "application/json": { schema: conflictError } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/leagues/{leagueId}/teams/{leagueTeamId}/members/candidates",
  tags: ["Leagues"],
  summary: "List roster candidates (manager)",
  request: { params: leagueTeamParamSchema, query: candidatesQuerySchema },
  responses: {
    "200": {
      description: "Candidates fetched",
      content: {
        "application/json": {
          schema: successResponseSchema(leagueCandidateListDataSchema, {
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
      description: "Not the manager of the team organization",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Team not found in this league",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.leagueTeam.notFound),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/leagues/{leagueId}/teams/{leagueTeamId}/members",
  tags: ["Leagues"],
  summary: "Add members to league roster (manager)",
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
          schema: successResponseSchema(z.array(leagueMemberSchema), {
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
      description: "Not the manager of the team organization",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Team or member not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.leagueTeam.notFound),
        },
      },
    },
    "409": {
      description: "Already in roster or player in another team",
      content: { "application/json": { schema: conflictError } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/leagues/{leagueId}/teams/{leagueTeamId}/members/{memberId}",
  tags: ["Leagues"],
  summary: "Remove a member from league roster (manager)",
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
      description: "Not the manager of the team organization",
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
      description: "Registration closed",
      content: { "application/json": { schema: conflictError } },
    },
  },
});