import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateTeamDelete } from "./team.rules.ts";

describe("evaluateTeamDelete", () => {
  it("empty list allowed", () => {
    assert.deepEqual(evaluateTeamDelete([]), { allowed: true });
  });
  it("INACTIVE and FINISHED allowed", () => {
    assert.deepEqual(evaluateTeamDelete(["INACTIVE", "FINISHED"]), {
      allowed: true,
    });
  });
  it("REGISTRATION denied", () => {
    assert.deepEqual(evaluateTeamDelete(["REGISTRATION"]), {
      allowed: false,
      reason: "IN_OPEN_LEAGUE",
    });
  });
  it("ACTIVE denied", () => {
    assert.deepEqual(evaluateTeamDelete(["ACTIVE"]), {
      allowed: false,
      reason: "IN_OPEN_LEAGUE",
    });
  });
  it("mixed list denied", () => {
    assert.deepEqual(
      evaluateTeamDelete(["FINISHED", "ACTIVE", "INACTIVE"]),
      { allowed: false, reason: "IN_OPEN_LEAGUE" },
    );
  });
});
