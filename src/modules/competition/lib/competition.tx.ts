import prisma from "../../../config/db.config.ts";

export type CompetitionTransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];
