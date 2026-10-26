import { makeAdvisory, type Advisory } from "../../../../shared/advisory.ts";
import { messages } from "../../../../language/message.ts";
import type { FormatLockReason } from "./format.rules.ts";

export type FormatLockCode = Exclude<FormatLockReason, null>;

/**
 * Turns the internal lock code into display data. Both codes block editing, so
 * both are BLOCKER; `HAS_GAMES` is reserved for Stage 3 and is not emitted yet.
 */
export function buildFormatLock(
  reason: FormatLockReason,
): Advisory<FormatLockCode> | null {
  if (reason === null) return null;
  const message =
    reason === "FINISHED"
      ? messages.advisory.format.finished
      : messages.advisory.format.hasGames;
  return makeAdvisory(reason, "BLOCKER", message);
}
