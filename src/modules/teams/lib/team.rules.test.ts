import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getTeamLockReason,
  TEAM_DELETE_BLOCKING_LEAGUE_STATUSES,
} from "./team.rules.ts";

describe("getTeamLockReason", () => {
  it("not locked returns null", () => {
    assert.equal(getTeamLockReason(false), null);
  });
  it("locked returns IN_OPEN_LEAGUE", () => {
    assert.equal(getTeamLockReason(true), "IN_OPEN_LEAGUE");
  });
});

describe("TEAM_DELETE_BLOCKING_LEAGUE_STATUSES", () => {
  it("blocks only REGISTRATION and ACTIVE", () => {
    assert.deepEqual([...TEAM_DELETE_BLOCKING_LEAGUE_STATUSES], [
      "REGISTRATION",
      "ACTIVE",
    ]);
  });
});
