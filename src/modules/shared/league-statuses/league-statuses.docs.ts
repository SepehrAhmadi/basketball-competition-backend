import { z } from "zod";
import { registry } from "../../../swagger/registry.ts";
import {
  successResponseSchema,
  errorResponseSchema,
} from "../../../swagger/helpers.ts";
import { messages } from "../../../language/message.ts";

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
  path: "/league-statuses",
  tags: ["League Statuses"],
  summary: "Get all league statuses with Persian labels",
  description:
    "Returns the list of league status values, each with its enum value and a Persian display label. Intended for dropdown / reference-data usage on the admin panel and PWA.",
  security: [{ bearerAuth: [] }],
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
    "401": {
      description: "Missing or invalid access token",
      content: {
        "application/json": {
          schema: errorResponseSchema(401, "Unauthorized"),
        },
      },
    },
  },
});
