import { z } from "zod";
import { registry } from "../../../../../swagger/registry.ts";
import { successResponseSchema } from "../../../../../swagger/helpers.ts";
import { messages } from "../../../../../language/message.ts";

const groupRoundTypeEnum = z
  .enum(["ONE_ROUND", "DOUBLE_ROUND"])
  .openapi("GroupRoundTypeOptionValue");

const roundTypeItemSchema = z
  .object({
    value: groupRoundTypeEnum,
    label: z.string().openapi({ example: "یک‌دوره (همه با همه)" }),
  })
  .openapi("GroupRoundTypeItem");

const groupRoundTypesDataSchema = z.object({
  roundTypes: z.array(roundTypeItemSchema),
});

registry.registerPath({
  method: "get",
  path: "/dropdown/group-round-types",
  tags: ["Dropdowns"],
  summary: "Get all group round types with Persian labels",
  description:
    "Returns the list of group round type values, each with its enum value and a Persian display label. Intended for dropdown / reference-data usage on the admin panel and PWA.",
  security: [],
  responses: {
    "200": {
      description: "List of group round types",
      content: {
        "application/json": {
          schema: successResponseSchema(groupRoundTypesDataSchema, {
            messageExample: messages.success.groupRoundTypes.fetched,
          }),
        },
      },
    },
  },
});
