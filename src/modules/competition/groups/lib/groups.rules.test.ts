import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  effectiveQualifiers,
  evaluateCreateGroup,
  evaluateGroupIssues,
  getGroupsLockReason,
  MAX_GROUPS_SINGLE_GROUP_FORMAT,
  MIN_TEAMS_PER_GROUP,
} from "./groups.rules.ts";

describe("evaluateCreateGroup", () => {
  it("denies null format", () => {
    assert.deepEqual(evaluateCreateGroup(null, 0), {
      allowed: false,
      reason: "FORMAT_NOT_GROUPED",
    });
  });
  it("denies KNOCKOUT_ONLY", () => {
    assert.deepEqual(evaluateCreateGroup("KNOCKOUT_ONLY", 0), {
      allowed: false,
      reason: "FORMAT_NOT_GROUPED",
    });
  });
  it("allows GROUPS_KNOCKOUT", () => {
    assert.deepEqual(evaluateCreateGroup("GROUPS_KNOCKOUT", 2), {
      allowed: true,
    });
  });
  it("allows SINGLE_GROUP_KNOCKOUT with no groups", () => {
    assert.deepEqual(evaluateCreateGroup("SINGLE_GROUP_KNOCKOUT", 0), {
      allowed: true,
    });
  });
  it("denies second group in SINGLE_GROUP_KNOCKOUT", () => {
    assert.deepEqual(
      evaluateCreateGroup("SINGLE_GROUP_KNOCKOUT", MAX_GROUPS_SINGLE_GROUP_FORMAT),
      { allowed: false, reason: "SINGLE_GROUP_ONLY" },
    );
  });
});

describe("effectiveQualifiers", () => {
  it("override wins", () => {
    assert.equal(effectiveQualifiers(3, 2), 3);
  });
  it("falls back to default", () => {
    assert.equal(effectiveQualifiers(null, 2), 2);
  });
  it("both null gives null", () => {
    assert.equal(effectiveQualifiers(null, null), null);
  });
});

describe("evaluateGroupIssues", () => {
  it("empty group is too small", () => {
    assert.deepEqual(
      evaluateGroupIssues({ teamsCount: 0, qualifiers: null }),
      ["GROUP_TOO_SMALL"],
    );
  });
  it("one team is too small", () => {
    assert.deepEqual(
      evaluateGroupIssues({ teamsCount: 1, qualifiers: 1 }),
      ["GROUP_TOO_SMALL"],
    );
  });
  it("min teams with no qualifiers is fine", () => {
    assert.deepEqual(
      evaluateGroupIssues({ teamsCount: MIN_TEAMS_PER_GROUP, qualifiers: null }),
      [],
    );
  });
  it("qualifiers below teams is fine", () => {
    assert.deepEqual(
      evaluateGroupIssues({ teamsCount: 4, qualifiers: 2 }),
      [],
    );
  });
  it("qualifiers equal to teams warns", () => {
    assert.deepEqual(
      evaluateGroupIssues({ teamsCount: 4, qualifiers: 4 }),
      ["QUALIFIERS_EXCEED_TEAMS"],
    );
  });
  it("qualifiers above teams warns", () => {
    assert.deepEqual(
      evaluateGroupIssues({ teamsCount: 2, qualifiers: 5 }),
      ["QUALIFIERS_EXCEED_TEAMS"],
    );
  });
});

describe("getGroupsLockReason", () => {
  it("FINISHED locks", () => {
    assert.equal(getGroupsLockReason("FINISHED"), "FINISHED");
  });
  it("other statuses do not lock", () => {
    for (const s of ["INACTIVE", "REGISTRATION", "ACTIVE"] as const)
      assert.equal(getGroupsLockReason(s), null);
  });
});
