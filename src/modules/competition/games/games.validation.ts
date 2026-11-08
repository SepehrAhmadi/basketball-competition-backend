import "../../../swagger/zod-extend.ts";
import { z } from "zod";
import { paginationQuerySchema } from "../../../shared/schemas.validation.ts";
import { jalaliToGregorian } from "../../../utils/date.util.ts";
import { leagueIdParamSchema } from "../../leagues/leagues.validation.ts";
import { GAME_STATUS_VALUES } from "./lib/games.rules.ts";

export { leagueIdParamSchema };

export const idField = (example: number) =>
  z.coerce
    .number({ invalid_type_error: "The value must be a number" })
    .int()
    .positive()
    .openapi({ example });

export const jalaliDateSchema = z
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

export const gameIdParamSchema = z.object({
  leagueId: idField(1),
  gameId: idField(1),
});

export const gamesListQuerySchema = paginationQuerySchema.extend({
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

export default {
  leagueIdParamSchema,
  gameIdParamSchema,
  gamesListQuerySchema,
};
