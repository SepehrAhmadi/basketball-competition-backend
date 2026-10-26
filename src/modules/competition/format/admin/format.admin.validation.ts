import "../../../../swagger/zod-extend.ts";
import { z } from "zod";
import { messages } from "../../../../language/message.ts";
import { leagueIdParamSchema } from "../../../leagues/leagues.validation.ts";
import {
  GROUP_ROUND_TYPE_VALUES,
  LEAGUE_FORMAT_VALUES,
  isGroupStageFormat,
} from "../lib/format.rules.ts";

export { leagueIdParamSchema };

export const updateFormatSchema = z
  .object({
    format: z.enum(LEAGUE_FORMAT_VALUES),
    winPoints: z
      .number({ required_error: messages.error.leagueFormat.winPointsRequired })
      .int()
      .min(0)
      .max(10)
      .openapi({ example: 2 }),
    lossPoints: z
      .number({ required_error: messages.error.leagueFormat.lossPointsRequired })
      .int()
      .min(0)
      .max(10)
      .openapi({ example: 1 }),
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
