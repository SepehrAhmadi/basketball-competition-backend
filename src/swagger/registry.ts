// Importing the extension here guarantees `.openapi()` exists even when a
// validation file is imported outside of server.ts (e.g. tests importing app.ts).
import "./zod-extend.ts";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

export const registry = new OpenAPIRegistry();

// Register the JWT bearer auth scheme once, reused by every protected path.
registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});
