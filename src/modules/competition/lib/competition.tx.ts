import prisma from "../../../config/db.config.ts";
import { Prisma } from "../../../prisma/generated/prisma/client.ts";

export type CompetitionTransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

export async function runSerializable<T>(
  fn: (tx: CompetitionTransactionClient) => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error: unknown) {
      if (
        (error as { code?: string })?.code !== "P2034" ||
        attempt >= maxAttempts
      )
        throw error;
    }
  }
}