import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withTeamLock } from "./team.access.ts";

const policy = { view: true, edit: true, delete: true, createRoster: true };

describe("withTeamLock", () => {
  it("locked disables delete and passes other flags through", () => {
    const result = withTeamLock(policy, true);
    assert.deepEqual(result.can, { ...policy, delete: false });
    assert.equal(result.lock?.code, "IN_OPEN_LEAGUE");
  });
  it("unlocked keeps the policy and has no lock", () => {
    const result = withTeamLock(policy, false);
    assert.deepEqual(result.can, policy);
    assert.equal(result.lock, null);
  });
  it("never grants delete the policy denied", () => {
    assert.equal(withTeamLock({ ...policy, delete: false }, false).can.delete, false);
  });
});
