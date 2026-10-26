import { makeAdvisory, type Advisory } from "../../../shared/advisory.ts";
import { messages } from "../../../language/message.ts";
import type { LockReason } from "../leagues.policy.ts";
import type { IneligibilityReason } from "./league.rules.ts";

export type ToggleLockCode = Exclude<LockReason, null>;

/**
 * Why a roster row cannot be toggled by this actor. `null` means "no reason"
 * and is a normal answer: view-only roles get `canToggle: false` with no lock
 * because the restriction is the role itself, not one specific row rule.
 */
export function buildToggleLock(
  reason: LockReason,
): Advisory<ToggleLockCode> | null {
  if (reason === null) return null;
  const message =
    reason === "OWN_ROW"
      ? messages.advisory.leagueRoster.ownRow
      : messages.advisory.leagueRoster.managerOnly;
  return makeAdvisory(reason, "BLOCKER", message);
}

/** Why a player cannot be added to this league's roster. */
export function buildIneligibility(
  reason: IneligibilityReason | null,
): Advisory<IneligibilityReason> | null {
  if (reason === null) return null;
  switch (reason) {
    case "BIRTH_DATE_MISSING":
      return makeAdvisory(
        reason,
        "BLOCKER",
        messages.advisory.leagueRoster.birthDateMissing,
      );
    case "TOO_OLD":
      return makeAdvisory(
        reason,
        "BLOCKER",
        messages.advisory.leagueRoster.tooOld,
      );
    case "IN_OTHER_TEAM":
      return makeAdvisory(
        reason,
        "BLOCKER",
        messages.advisory.leagueRoster.inOtherTeam,
      );
  }
}
