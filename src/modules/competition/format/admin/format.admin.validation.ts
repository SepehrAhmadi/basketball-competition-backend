import "../../../../swagger/zod-extend.ts";
import { z } from "zod";
import { messages } from "../../../../language/message.ts";
import { leagueIdParamSchema } from "../../../leagues/leagues.validation.ts";
import {
  DEFAULT_LOSS_POINTS,
  DEFAULT_WIN_POINTS,
  GROUP_ROUND_TYPE_VALUES,
  LEAGUE_FORMAT_VALUES,
  isGroupStageFormat,
} from "../lib/format.rules.ts";

export { leagueIdParamSchema };

export const updateFormatSchema = z
  .object({
    format: z.enum(LEAGUE_FORMAT_VALUES),
    winPoints: z
      .number()
      .int()
      .min(0)
      .max(10)
      .default(DEFAULT_WIN_POINTS)
      .openapi({ example: DEFAULT_WIN_POINTS }),
    lossPoints: z
      .number()
      .int()
      .min(0)
      .max(10)
      .default(DEFAULT_LOSS_POINTS)
      .openapi({ example: DEFAULT_LOSS_POINTS }),
    groupRoundType: z
      .enum(GROUP_ROUND_TYPE_VALUES)
      .optional()
      .openapi({ example: "ONE_ROUND" }),
    defaultQualifiersPerGroup: z
      .number()
      .int()
      .positive()
      .max(64)
      .optional()
      .openapi({ example: 2 }),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.winPoints <= data.lossPoints) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["winPoints"],
        message: messages.error.leagueFormat.winPointsMustExceedLoss,
      });
    }

    if (!isGroupStageFormat(data.format)) return;

    if (!data.groupRoundType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["groupRoundType"],
        message: messages.error.leagueFormat.groupRoundTypeRequired,
      });
    }

    if (data.defaultQualifiersPerGroup === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultQualifiersPerGroup"],
        message: messages.error.leagueFormat.qualifiersRequired,
      });
    }
  });

export default {
  leagueIdParamSchema,
  updateFormatSchema,
};
