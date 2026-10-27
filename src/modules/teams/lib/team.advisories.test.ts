import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTeamLock } from "./team.advisories.ts";

describe("buildTeamLock", () => {
  it("not locked returns null", () => {
    assert.equal(buildTeamLock(false), null);
  });
  it("locked is BLOCKER", () => {
    const lock = buildTeamLock(true);
    assert.equal(lock?.code, "IN_OPEN_LEAGUE");
    assert.equal(lock?.severity, "BLOCKER");
    assert.ok(lock?.message.length);
  });
});
