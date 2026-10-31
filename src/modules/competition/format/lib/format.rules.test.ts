import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateFormatChange,
  getFormatLockReason,
  GROUP_ROUND_TYPE_VALUES,
  isGroupedFormat,
  LEAGUE_FORMAT_VALUES,
} from "./format.rules.ts";
import {
  GroupRoundType,
  LeagueFormat,
} from "../../../../prisma/generated/prisma/enums.ts";

describe("isGroupedFormat", () => {
  it("null is not grouped", () => {
    assert.equal(isGroupedFormat(null), false);
  });
  it("group-stage formats are grouped", () => {
    assert.equal(isGroupedFormat("GROUPS_KNOCKOUT"), true);
    assert.equal(isGroupedFormat("SINGLE_GROUP_KNOCKOUT"), true);
  });
  it("KNOCKOUT_ONLY is not grouped", () => {
    assert.equal(isGroupedFormat("KNOCKOUT_ONLY"), false);
  });
});

describe("getFormatLockReason", () => {
  it("FINISHED is locked", () => {
    assert.equal(getFormatLockReason("FINISHED"), "FINISHED");
  });
  it("other statuses are not locked", () => {
    for (const s of ["INACTIVE", "REGISTRATION", "ACTIVE"] as const)
      assert.equal(getFormatLockReason(s), null);
  });
});

describe("value lists", () => {
  it("equal the Prisma enums", () => {
    assert.deepEqual([...LEAGUE_FORMAT_VALUES], Object.values(LeagueFormat));
    assert.deepEqual([...GROUP_ROUND_TYPE_VALUES], Object.values(GroupRoundType));
  });
});

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
