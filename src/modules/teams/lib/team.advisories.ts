import { makeAdvisory, type Advisory } from "../../../shared/advisory.ts";
import { messages } from "../../../language/message.ts";
import type { TeamDeleteDenial } from "./team.rules.ts";

export type TeamLockCode = TeamDeleteDenial;

export function buildTeamLock(
  reason: TeamLockCode | null,
): Advisory<TeamLockCode> | null {
  if (reason === null) return null;
  return makeAdvisory(reason, "BLOCKER", messages.advisory.team.inOpenLeague, {});
}
