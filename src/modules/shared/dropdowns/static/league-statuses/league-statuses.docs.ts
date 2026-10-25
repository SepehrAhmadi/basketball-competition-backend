import { z } from "zod";
import { registry } from "../../../../../swagger/registry.ts";
import { successResponseSchema } from "../../../../../swagger/helpers.ts";
import { messages } from "../../../../../language/message.ts";

const leagueStatusEnum = z
  .enum(["INACTIVE", "REGISTRATION", "ACTIVE", "FINISHED"])
  .openapi("LeagueStatusValue");

const statusItemSchema = z
  .object({
    value: leagueStatusEnum,
    label: z.string().openapi({ example: "در حال ثبت‌نام" }),
  })
  .openapi("LeagueStatusItem");

const leagueStatusesDataSchema = z.object({
  statuses: z.array(statusItemSchema),
});

registry.registerPath({
  method: "get",
  path: "/dropdown/league-statuses",
  tags: ["Dropdowns"],
  summary: "Get all league statuses with Persian labels",
  description:
    "Returns the list of league status values, each with its enum value and a Persian display label. Intended for dropdown / reference-data usage on the admin panel and PWA.",
  security: [],
  responses: {
    "200": {
      description: "List of league statuses",
      content: {
        "application/json": {
          schema: successResponseSchema(leagueStatusesDataSchema, {
            messageExample: messages.success.leagueStatuses.fetched,
          }),
        },
      },
    },
  },
});
