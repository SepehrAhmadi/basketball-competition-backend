import { z, type ZodTypeAny } from "zod";

// Wraps any data schema in the standard success envelope returned by
// apiResponse.sendResponse: { statusCode, message, data }.
export function successResponseSchema<T extends ZodTypeAny>(
  dataSchema: T,
  options?: { statusCode?: number; messageExample?: string },
) {
  return z.object({
    statusCode: z.number().openapi({ example: options?.statusCode ?? 200 }),
    message: z.string().openapi({
      example: options?.messageExample ?? "success",
    }),
    data: dataSchema,
  });
}

// Standard error envelope returned by the errorHandler middleware:
// { statusCode, message }. A factory so every status code keeps its own
// realistic example in the docs.
export function errorResponseSchema(
  statusCode = 400,
  messageExample = "Validation failed",
) {
  return z.object({
    statusCode: z.number().openapi({ example: statusCode }),
    message: z.string().openapi({ example: messageExample }),
  });
}
