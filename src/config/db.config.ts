import { PrismaClient } from "../prisma/generated/prisma/client.ts";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const {
  DATABASE_USER,
  DATABASE_PASSWORD,
  DATABASE_NAME,
  DATABASE_HOST,
  DATABASE_PORT,
  DATABASE_SSL,
} = process.env;

const adapter = new PrismaMariaDb({
  host: DATABASE_HOST,
  port: Number(DATABASE_PORT),
  user: DATABASE_USER,
  password: DATABASE_PASSWORD,
  database: DATABASE_NAME,
  ssl: DATABASE_SSL === "true" ? true : undefined,
  connectionLimit: 5,
  connectTimeout: 20000,
  acquireTimeout: 30000,
});
const prisma = new PrismaClient({ adapter });

export default prisma;
