import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

const {
  DATABASE_USER,
  DATABASE_PASSWORD,
  DATABASE_NAME,
  DATABASE_HOST,
  DATABASE_PORT,
} = process.env;

const databaseUrl = `mysql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}`;

export default defineConfig({
  schema: path.join("src", "prisma", "schema.prisma"),
  migrations: {
    path: path.join("src", "prisma", "migrations"),
  },
  datasource: {
    url: databaseUrl,
  },
});
