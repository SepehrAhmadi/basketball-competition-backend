import type { Advisory } from "../../../shared/advisory.ts";
import { buildTeamLock, type TeamLockCode } from "./team.advisories.ts";
import { getTeamLockReason } from "./team.rules.ts";

type WithDelete = { delete: boolean };

// A locked team cannot be deleted even when the policy would allow it.
export function withTeamLock<T extends WithDelete>(
  policy: T,
  locked: boolean,
): { can: T; lock: Advisory<TeamLockCode> | null } {
  return {
    can: { ...policy, delete: policy.delete && !locked },
    lock: buildTeamLock(getTeamLockReason(locked)),
  };
}
