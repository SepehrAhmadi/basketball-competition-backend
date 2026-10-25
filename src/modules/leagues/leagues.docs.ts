import { z } from "zod";
import { messages } from "../../language/message.ts";
import { registry } from "../../swagger/registry.ts";
import {
  errorResponseSchema,
  successResponseSchema,
} from "../../swagger/helpers.ts";
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

export const leagueSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    name: z.string().openapi({ example: "لیگ برتر نوجوانان" }),
    description: z.string().nullable().openapi({ example: null }),
    status: z.string().openapi({ example: "REGISTRATION" }),
    startDate: z.string().nullable().openapi({ example: "1404/06/01" }),
    endDate: z.string().nullable().openapi({ example: "1404/09/01" }),
    rosterDeadline: z.string().nullable().openapi({ example: "1404/05/20" }),
    ageCategoryCutoffId: z.number().openapi({ example: 1 }),
    format: z
      .enum(["GROUPS_KNOCKOUT", "SINGLE_GROUP_KNOCKOUT", "KNOCKOUT_ONLY"])
      .nullable()
      .openapi({ example: "GROUPS_KNOCKOUT" }),
    winPoints: z.number().openapi({ example: 2 }),
    lossPoints: z.number().openapi({ example: 1 }),
    groupRoundType: z
      .enum(["ONE_ROUND", "DOUBLE_ROUND"])
      .nullable()
      .openapi({ example: "ONE_ROUND" }),
    defaultQualifiersPerGroup: z
      .number()
      .nullable()
      .openapi({ example: 2 }),
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
    createdAt: z.date().openapi({ example: "2026-01-01T10:00:00.000Z" }),
    updatedAt: z.date().openapi({ example: "2026-01-01T10:00:00.000Z" }),
    can: leagueCanSchema.optional(),
  })
  .openapi("League");

const leagueListDataSchema = z.object({
  items: z.array(leagueSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export const leagueTeamItemSchema = z
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
    createdAt: z.date().openapi({ example: "2026-01-01T10:00:00.000Z" }),
    can: leagueTeamCanSchema.optional(),
  })
  .openapi("LeagueTeamItem");

const leagueTeamListDataSchema = z.object({
  items: z.array(leagueTeamItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export const leagueMemberSchema = z
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

export const leagueCandidateSchema = leagueMemberSchema
  .omit({ id: true })
  .extend({
    leagueTeamMemberId: z
      .number()
      .nullable()
      .openapi({
        example: 31,
        description:
          "Null when `selected` is false. Use as `memberId` for DELETE.",
      }),
    canToggle: z.boolean().openapi({ example: true }),
    toggleLockReason: z
      .enum(["OWN_ROW", "MANAGER_ONLY"])
      .nullable()
      .openapi({ example: null }),
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
  page: z.number(),
  pageSize: z.number(),
});

export const eligibleTeamSchema = z
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

const leagueRoleEnumSchema = z
  .enum(["MANAGER", "HEAD_COACH", "COACH", "PLAYER"])
  .openapi("LeagueRoleEnum");

const myLeagueSchema = z
  .object({
    league: leagueSchema,
    myRoles: z
      .array(leagueRoleEnumSchema)
      .openapi({ example: ["MANAGER", "HEAD_COACH"] }),
    myTeamsCount: z.number().openapi({ example: 2 }),
  })
  .openapi("MyLeague");

const leagueSummarySchema = z.object({
  id: z.number().openapi({ example: 1 }),
  name: z.string().openapi({ example: "لیگ برتر نوجوانان" }),
  status: z.string().openapi({ example: "REGISTRATION" }),
  rosterDeadline: z.string().nullable().openapi({ example: "1404/05/20" }),
});

const teamRefSchema = z.object({
  id: z.number().openapi({ example: 12 }),
  name: z.string().openapi({ example: "عقاب" }),
  logoUrl: z.string().nullable().openapi({ example: null }),
});

const organizationRefSchema = z.object({
  id: z.number().openapi({ example: 3 }),
  name: z.string().openapi({ example: "باشگاه عقاب" }),
});

const myLeagueTeamSchema = z
  .object({
    leagueTeamId: z.number().openapi({ example: 5 }),
    team: teamRefSchema,
    organization: organizationRefSchema,
    myRoles: z.array(leagueRoleEnumSchema),
    membersCount: z.number().openapi({ example: 9 }),
    can: leagueTeamCanSchema,
  })
  .openapi("MyLeagueTeam");

const myTeamsResponseSchema = z
  .object({
    league: leagueSummarySchema,
    items: z.array(myLeagueTeamSchema),
    total: z.number(),
  })
  .openapi("MyTeamsResponse");

const leagueTeamDetailSchema = z
  .object({
    id: z.number().openapi({ example: 5 }),
    league: leagueSummarySchema,
    team: teamRefSchema,
    organization: organizationRefSchema,
    counts: z.object({
      coaches: z.number().openapi({ example: 2 }),
      players: z.number().openapi({ example: 9 }),
    }),
    myRoles: z.array(leagueRoleEnumSchema),
    can: leagueTeamCanSchema,
  })
  .openapi("LeagueTeamDetail");

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
          schema: errorResponseSchema(404, messages.error.leagueTeam.notFound),
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
  path: "/leagues/{leagueId}/my-teams",
  tags: ["Leagues"],
  summary: "List my teams in a league",
  description:
    "Managers see all ACTIVE league teams of the organizations they manage; " +
    "everyone else sees only teams where they have an ACTIVE roster row. " +
    "Not paginated.",
  request: { params: leagueIdParamSchema },
  responses: {
    "200": {
      description: "My league teams fetched",
      content: {
        "application/json": {
          schema: successResponseSchema(myTeamsResponseSchema, {
            messageExample: messages.success.leagueTeam.myList,
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
  method: "get",
  path: "/leagues/{leagueId}/teams/{leagueTeamId}",
  tags: ["Leagues"],
  summary: "Get a team registered in a league (public)",
  description: publicNote,
  security: [],
  request: { params: leagueTeamParamSchema },
  responses: {
    "200": {
      description: "League team found",
      content: {
        "application/json": {
          schema: successResponseSchema(leagueTeamDetailSchema, {
            messageExample: messages.success.leagueTeam.found,
          }),
        },
      },
    },
    "404": {
      description: "League or team not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.leagueTeam.notFound),
        },
      },
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
      description: "Already registered, registration closed, or unregister from ACTIVE league forbidden",
      content: { "application/json": { schema: conflictError } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/leagues/{leagueId}/teams/{leagueTeamId}/members/candidates",
  tags: ["Leagues"],
  summary: "List roster candidates (league team members)",
  description:
    "Ordered selected first, then head coach, coaches, players. " +
    "Any ACTIVE member of this league team (manager, league head coach, coach, player) may view; outsiders get 403. Editing is still gated per-row via canToggle.",
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
      description: "Not a member of this league team",
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
      description: "Team or member not found (missing member ids are listed)",
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
      description: "Registration closed or removing the last player of a team in an ACTIVE league",
      content: { "application/json": { schema: conflictError } },
    },
  },
});