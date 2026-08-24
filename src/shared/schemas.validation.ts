// Must run before this file's schema definitions call .openapi() — this module
// is imported by route files that may bypass server.ts (e.g. tests).
import "../swagger/zod-extend.ts";
import { z } from "zod";

// Reused by every module's GET /:id / PUT /:id / DELETE /:id routes.
export const idParamSchema = z.object({
  id: z.coerce
    .number({ invalid_type_error: "The value must be a number" })
    .int()
    .positive()
    .openapi({ example: 1 }),
});

// Base pagination query params, reused/extended by every list endpoint.
export const paginationQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .positive()
    .default(1)
    .openapi({ example: 1 }),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(20)
    .openapi({ example: 20 }),
});

// Generic paginated list envelope, reused by every module's list schema.
export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number().openapi({ example: 42 }),
    page: z.number().openapi({ example: 1 }),
    pageSize: z.number().openapi({ example: 20 }),
  });
}
