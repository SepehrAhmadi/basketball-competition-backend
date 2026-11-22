import { Prisma } from "../../../prisma/generated/prisma/client.ts";
import type { CompetitionTransactionClient } from "./competition.tx.ts";

// Locks the given league_groups rows until the transaction ends.
// IDs are sorted so every transaction locks in the same order.
export async function lockGroups(
  tx: CompetitionTransactionClient,
  groupIds: number[],
): Promise<void> {
  const ids = [...new Set(groupIds)].sort((a, b) => a - b);
  if (ids.length === 0) return;
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM league_groups WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`,
  );
}
