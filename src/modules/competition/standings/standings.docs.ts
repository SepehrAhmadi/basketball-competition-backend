import "../../../swagger/zod-extend.ts";
import { z } from "zod";

export const standingRowSchema = z
  .object({
    rank: z.number().openapi({ example: 1 }),
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
        description:
          "Present only for FINISHED leagues, which keep showing " +
          "soft-deleted teams so the frontend can render them differently.",
      }),
    played: z.number().openapi({ example: 4 }),
    won: z.number().openapi({ example: 3 }),
    lost: z.number().openapi({ example: 1 }),
    points: z.number().openapi({ example: 7 }),
    pointsFor: z.number().openapi({ example: 300 }),
    pointsAgainst: z.number().openapi({ example: 260 }),
    difference: z.number().openapi({
      example: 40,
      description:
        "Raw signed total (pointsFor - pointsAgainst). Formatting is a frontend concern.",
    }),
    qualified: z.boolean().openapi({ example: true }),
  })
  .openapi("StandingRow");
