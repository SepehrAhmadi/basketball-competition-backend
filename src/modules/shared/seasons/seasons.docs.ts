import { z } from "zod";
import { registry } from "../../../swagger/registry.ts";
import {
  successResponseSchema,
} from "../../../swagger/helpers.ts";
import { messages } from "../../../language/message.ts";

const seasonOptionSchema = z
  .object({
    value: z.number().openapi({ example: 1, description: "Season ID" }),
    label: z
      .string()
      .openapi({ example: "1405/06/31", description: "Jalali start date" }),
  })
  .openapi("SeasonOption");

const seasonListResponseSchema = z
  .object({
    seasons: z.array(seasonOptionSchema),
  })
  .openapi("SeasonListResponse");

registry.registerPath({
  method: "get",
  path: "/seasons",
  tags: ["Seasons"],
  summary: "List seasons",
  description:
    "Returns all seasons as select-ready options with Jalali-formatted start dates. Ordered by start date descending (most recent first).",
  responses: {
    "200": {
      description: "List of seasons",
      content: {
        "application/json": {
          schema: successResponseSchema(seasonListResponseSchema, {
            messageExample: messages.success.seasons.list,
          }),
        },
      },
    },
  },
});
