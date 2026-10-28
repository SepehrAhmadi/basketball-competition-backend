import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildGroupIssues,
  buildGroupsLock,
  buildUnassignedIssue,
} from "./groups.advisories.ts";
import { evaluateGroupIssues } from "./groups.rules.ts";
import { messages } from "../../../../language/message.ts";

describe("buildGroupIssues", () => {
  it("too small is WARNING with params", () => {
    const [issue] = buildGroupIssues({
      id: 3,
      name: "گروه الف",
      teamsCount: 1,
      qualifiers: null,
    });
    assert.equal(issue.code, "GROUP_TOO_SMALL");
    assert.equal(issue.severity, "WARNING");
    assert.deepEqual(issue.params, {
      groupId: 3,
      name: "گروه الف",
      min: 2,
      current: 1,
    });
    assert.ok(issue.message.length > 0);
  });
  it("qualifiers exceed is WARNING with params", () => {
    const [issue] = buildGroupIssues({
      id: 3,
      name: "گروه الف",
      teamsCount: 2,
      qualifiers: 2,
    });
    assert.equal(issue.code, "QUALIFIERS_EXCEED_TEAMS");
    assert.equal(issue.severity, "WARNING");
    assert.deepEqual(issue.params, {
      groupId: 3,
      name: "گروه الف",
      qualifiers: 2,
      current: 2,
    });
  });
  it("issue codes derive from evaluateGroupIssues", () => {
    const cases = [
      { teamsCount: 0, qualifiers: null },
      { teamsCount: 1, qualifiers: 5 },
      { teamsCount: 2, qualifiers: 2 },
      { teamsCount: 3, qualifiers: 2 },
      { teamsCount: 4, qualifiers: null },
    ];
    for (const c of cases)
      assert.deepEqual(
        buildGroupIssues({ id: 1, name: "x", ...c }).map((i) => i.code),
        evaluateGroupIssues(c),
      );
  });
  it("healthy group has no issues", () => {
    assert.deepEqual(
      buildGroupIssues({ id: 1, name: "x", teamsCount: 4, qualifiers: 2 }),
      [],
    );
  });
});

describe("buildUnassignedIssue", () => {
  it("zero count returns empty", () => {
    assert.deepEqual(buildUnassignedIssue(0), []);
  });
  it("positive count is WARNING", () => {
    const [issue] = buildUnassignedIssue(3);
    assert.equal(issue.code, "TEAM_UNASSIGNED");
    assert.equal(issue.severity, "WARNING");
    assert.deepEqual(issue.params, { count: 3 });
  });
});

describe("buildGroupsLock", () => {
  it("null reason returns null", () => {
    assert.equal(buildGroupsLock(null), null);
  });
  it("FINISHED is BLOCKER", () => {
    const lock = buildGroupsLock("FINISHED");
    assert.equal(lock?.code, "FINISHED");
    assert.equal(lock?.severity, "BLOCKER");
    assert.equal(lock?.message, messages.advisory.leagueFinished);
  });
});
