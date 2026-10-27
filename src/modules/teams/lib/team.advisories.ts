import { makeAdvisory, type Advisory } from "../../../shared/advisory.ts";
import { messages } from "../../../language/message.ts";
import type { TeamDeleteDenial } from "./team.rules.ts";

export type TeamLockCode = TeamDeleteDenial;

export function buildTeamLock(
  denied: boolean,
): Advisory<TeamLockCode> | null {
  if (!denied) return null;
  return makeAdvisory(
    "IN_OPEN_LEAGUE",
    "BLOCKER",
    messages.advisory.team.inOpenLeague,
    {},
  );
}
