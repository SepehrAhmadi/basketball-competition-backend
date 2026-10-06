import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

const {
  DATABASE_USER,
  DATABASE_PASSWORD,
  DATABASE_NAME,
  DATABASE_HOST,
  DATABASE_PORT,
  DATABASE_SSL,
} = process.env;

const databaseUrl =
  `mysql://${encodeURIComponent(DATABASE_USER!)}:${encodeURIComponent(DATABASE_PASSWORD!)}` +
  `@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}` +
  (DATABASE_SSL === "true" ? "?sslaccept=strict" : "");

export default defineConfig({
  schema: path.join("src", "prisma", "schema.prisma"),
  migrations: {
    path: path.join("src", "prisma", "migrations"),
    seed: "tsx src/prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});