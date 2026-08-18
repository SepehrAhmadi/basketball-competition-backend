import { PrismaClient } from "../prisma/generated/prisma/client.ts";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const {
  DATABASE_USER,
  DATABASE_PASSWORD,
  DATABASE_NAME,
  DATABASE_HOST,
  DATABASE_PORT,
} = process.env;

const DATABASE_URL = `mysql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}`;

const adapter = new PrismaMariaDb(DATABASE_URL);
const prisma = new PrismaClient({ adapter });

export default prisma;
