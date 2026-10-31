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

const INELIGIBILITY_MESSAGES: Record<IneligibilityReason, string> = {
  BIRTH_DATE_MISSING: messages.advisory.leagueRoster.birthDateMissing,
  TOO_OLD: messages.advisory.leagueRoster.tooOld,
  IN_OTHER_TEAM: messages.advisory.leagueRoster.inOtherTeam,
};

/** Why a player cannot be added to this league's roster. */
export function buildIneligibility(
  reason: IneligibilityReason | null,
): Advisory<IneligibilityReason> | null {
  if (reason === null) return null;
  return makeAdvisory(reason, "BLOCKER", INELIGIBILITY_MESSAGES[reason]);
}
