import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTeamLock } from "./team.advisories.ts";

describe("buildTeamLock", () => {
  it("null reason returns null", () => {
    assert.equal(buildTeamLock(null), null);
  });
  it("IN_OPEN_LEAGUE is BLOCKER", () => {
    const lock = buildTeamLock("IN_OPEN_LEAGUE");
    assert.equal(lock?.code, "IN_OPEN_LEAGUE");
    assert.equal(lock?.severity, "BLOCKER");
    assert.ok(lock?.message.length);
  });
});
