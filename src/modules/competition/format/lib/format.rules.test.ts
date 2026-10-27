import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateFormatChange } from "./format.rules.ts";

describe("evaluateFormatChange", () => {
  it("GROUPS_KNOCKOUT always allowed", () => {
    for (const n of [0, 1, 2])
      assert.deepEqual(evaluateFormatChange("GROUPS_KNOCKOUT", n), {
        allowed: true,
      });
  });
  it("KNOCKOUT_ONLY blocked when groups exist", () => {
    assert.deepEqual(evaluateFormatChange("KNOCKOUT_ONLY", 0), {
      allowed: true,
    });
    assert.deepEqual(evaluateFormatChange("KNOCKOUT_ONLY", 1), {
      allowed: false,
      reason: "HAS_GROUPS",
    });
    assert.deepEqual(evaluateFormatChange("KNOCKOUT_ONLY", 2), {
      allowed: false,
      reason: "HAS_GROUPS",
    });
  });
  it("SINGLE_GROUP_KNOCKOUT blocked when more than one group", () => {
    for (const n of [0, 1])
      assert.deepEqual(evaluateFormatChange("SINGLE_GROUP_KNOCKOUT", n), {
        allowed: true,
      });
    assert.deepEqual(evaluateFormatChange("SINGLE_GROUP_KNOCKOUT", 2), {
      allowed: false,
      reason: "TOO_MANY_GROUPS",
    });
  });
});
