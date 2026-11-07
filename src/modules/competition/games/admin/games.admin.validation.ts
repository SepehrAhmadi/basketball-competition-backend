import "../../../../swagger/zod-extend.ts";
import { z } from "zod";
import { messages } from "../../../../language/message.ts";
import { paginationQuerySchema } from "../../../../shared/schemas.validation.ts";
import {
  jalaliToGregorian,
  jalaliToGregorianOrNull,
} from "../../../../utils/date.util.ts";
import { leagueIdParamSchema } from "../../../leagues/leagues.validation.ts";
import { GAME_STATUS_VALUES } from "../lib/games.rules.ts";

export { leagueIdParamSchema };
export { jalaliToGregorianOrNull as toGregorianOrNull };

const idField = (example: number) =>
  z.coerce
    .number({ invalid_type_error: "The value must be a number" })
    .int()
    .positive()
    .openapi({ example });

const jalaliDateSchema = z
  .string()
  .refine(
    (value) => {
      try {
        jalaliToGregorian(value);
        return true;
      } catch {
        return false;
      }
    },
    "Game date must be a valid Jalali date in YYYY/MM/DD format.",
  )
  .openapi({
    example: "1405/08/16",
    description: "Jalali date in YYYY/MM/DD format",
  });

const timeField = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    messages.error.game.dateTimeTogether,
  )
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
    });
  }
}

export const gameIdParamSchema = z.object({
  leagueId: idField(1),
  gameId: idField(1),
});

export const publicGamesQuerySchema = paginationQuerySchema.extend({
  status: z.enum(GAME_STATUS_VALUES).optional(),
  groupId: z.coerce.number().int().positive().optional().openapi({ example: 3 }),
  leagueTeamId: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .openapi({ example: 11 }),
  dateFrom: jalaliDateSchema.optional(),
  dateTo: jalaliDateSchema.optional(),
});

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
    { message: messages.error.game.dateTimeTogether },
  );

export const updateGameStatusSchema = z
  .object({
    status: z.enum(["LIVE", "CANCELED"]).openapi({ example: "LIVE" }),
    cancelReason: z.string().max(5000).nullable().optional(),
  })
  .strict();

export const enterGameResultSchema = z.discriminatedUnion("resultType", [
  z
    .object({
      resultType: z.literal("NORMAL"),
      homeScore: z.number().int().openapi({ example: 78 }),
      awayScore: z.number().int().openapi({ example: 71 }),
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
  publicGamesQuerySchema,
  createGameSchema,
  updateGameScheduleSchema,
  updateGameStatusSchema,
  enterGameResultSchema,
};
