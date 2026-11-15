import "../../../../swagger/zod-extend.ts";
import { z } from "zod";
import { messages } from "../../../../language/message.ts";
import {
  gameIdParamSchema,
  idField,
  jalaliDateSchema,
  leagueIdParamSchema,
  gamesListQuerySchema,
} from "../games.validation.ts";

export { leagueIdParamSchema, gameIdParamSchema, gamesListQuerySchema };

const timeField = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, messages.error.game.timeInvalid)
  .openapi({ example: "17:00" });

function dateTimeTogether(
  data: { scheduledDate?: string | null; scheduledTime?: string | null },
  ctx: z.RefinementCtx,
) {
  const date = data.scheduledDate ?? null;
  const time = data.scheduledTime ?? null;
  if ((date === null) !== (time === null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: messages.error.game.dateTimeTogether,
      path: [date === null ? "scheduledDate" : "scheduledTime"],
    });
  }
}

export const createGameSchema = z
  .object({
    homeLeagueTeamId: idField(11),
    awayLeagueTeamId: idField(12),
    scheduledDate: jalaliDateSchema.nullable().optional(),
    scheduledTime: timeField.nullable().optional(),
    rescheduledFromGameId: idField(7).nullable().optional(),
  })
  .strict()
  .superRefine(dateTimeTogether);

export const updateGameScheduleSchema = z
  .object({
    scheduledDate: jalaliDateSchema.nullable().optional(),
    scheduledTime: timeField.nullable().optional(),
  })
  .strict()
  .superRefine(dateTimeTogether)
  .refine(
    (data) =>
      data.scheduledDate !== undefined || data.scheduledTime !== undefined,
    { message: messages.error.game.updateFieldRequired },
  );

export const updateGameStatusSchema = z
  .object({
    status: z.enum(["LIVE", "CANCELED"]).openapi({ example: "LIVE" }),
    cancelReason: z.string().max(5000).nullable().optional(),
  })
  .strict()
  .refine(
    (data) => data.status === "CANCELED" || data.cancelReason == null,
    {
      message: messages.error.game.cancelReasonNotAllowed,
      path: ["cancelReason"],
    },
  );

const scoreField = (example: number) =>
  z
    .number()
    .int(messages.error.game.scoreInvalid)
    .min(0, messages.error.game.scoreInvalid)
    .openapi({ example });

export const adminGamesListQuerySchema = gamesListQuerySchema.extend({
  resultPending: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true"))
    .openapi({
      example: "true",
      description:
        "true = only open games (SCHEDULED or LIVE) dated before today in Tehran",
    }),
});

export const enterGameResultSchema = z.discriminatedUnion("resultType", [
  z
    .object({
      resultType: z.literal("NORMAL"),
      homeScore: scoreField(78),
      awayScore: scoreField(71),
      resultNote: z.string().max(5000).nullable().optional(),
    })
    .strict(),
  z
    .object({
      resultType: z.literal("FORFEIT"),
      forfeitLeagueTeamId: idField(11),
      resultNote: z.string().max(5000).nullable().optional(),
    })
    .strict(),
]);

export default {
  leagueIdParamSchema,
  gameIdParamSchema,
  gamesListQuerySchema,
  adminGamesListQuerySchema,
  createGameSchema,
  updateGameScheduleSchema,
  updateGameStatusSchema,
  enterGameResultSchema,
};
