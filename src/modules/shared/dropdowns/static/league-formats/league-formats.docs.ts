import { z } from "zod";
import { registry } from "../../../../../swagger/registry.ts";
import { successResponseSchema } from "../../../../../swagger/helpers.ts";
import { messages } from "../../../../../language/message.ts";

const leagueFormatEnum = z
  .enum(["GROUPS_KNOCKOUT", "SINGLE_GROUP_KNOCKOUT", "KNOCKOUT_ONLY"])
  .openapi("LeagueFormatOptionValue");

const formatItemSchema = z
  .object({
    value: leagueFormatEnum,
    label: z.string().openapi({ example: "گروهی + حذفی" }),
  })
  .openapi("LeagueFormatItem");

const leagueFormatsDataSchema = z.object({
  formats: z.array(formatItemSchema),
});

registry.registerPath({
  method: "get",
  path: "/dropdown/league-formats",
  tags: ["Dropdowns"],
  summary: "Get all league formats with Persian labels",
  description:
    "Returns the list of league format values, each with its enum value and a Persian display label. Intended for dropdown / reference-data usage on the admin panel and PWA.",
  security: [],
  responses: {
    "200": {
      description: "List of league formats",
      content: {
        "application/json": {
          schema: successResponseSchema(leagueFormatsDataSchema, {
            messageExample: messages.success.leagueFormats.fetched,
          }),
        },
      },
    },
  },
});
