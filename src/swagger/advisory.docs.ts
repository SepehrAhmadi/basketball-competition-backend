import "./zod-extend.ts";
import { z } from "zod";

// Registered once as "Advisory"; every module docs file imports this single
// schema so the component is generated exactly once.
export const advisorySeveritySchema = z
  .enum(["INFO", "WARNING", "BLOCKER"])
  .openapi("AdvisorySeverity", {
    description:
      "INFO = informational. WARNING = allowed but incomplete or suspicious. " +
      "BLOCKER = prevents the action.",
  });

export const advisorySchema = z
  .object({
    code: z.string().openapi({
      example: "FINISHED",
      description:
        "Stable code for frontend logic (icon, color, filtering).",
    }),
    severity: advisorySeveritySchema,
    message: z.string().openapi({
      example: "لیگ تمام‌شده قابل ویرایش نیست",
      description: "Persian text, ready to display.",
    }),
    params: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
      .openapi({
        example: {},
        description: "Values interpolated into `message`, when any.",
      }),
  })
  .openapi("Advisory");
