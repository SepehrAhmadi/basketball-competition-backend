import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildIneligibility } from "./league.advisories.ts";
import type { IneligibilityReason } from "./league.rules.ts";

const reasons: IneligibilityReason[] = [
  "BIRTH_DATE_MISSING",
  "TOO_OLD",
  "IN_OTHER_TEAM",
];

describe("buildIneligibility", () => {
  it("null reason returns null", () => {
    assert.equal(buildIneligibility(null), null);
  });
  for (const reason of reasons) {
    it(`${reason} is a BLOCKER with a message`, () => {
      const advisory = buildIneligibility(reason);
      assert.equal(advisory?.code, reason);
      assert.equal(advisory?.severity, "BLOCKER");
      assert.ok(advisory?.message.length);
    });
  }
});
