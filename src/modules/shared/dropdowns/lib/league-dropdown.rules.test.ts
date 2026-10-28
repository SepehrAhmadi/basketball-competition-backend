import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildLeagueLabel, resolveLeagueStatuses } from "./league-dropdown.rules.ts";

describe("resolveLeagueStatuses", () => {
  it("no filter returns every status", () => {
    assert.deepEqual([...resolveLeagueStatuses()], [
      "INACTIVE",
      "REGISTRATION",
      "ACTIVE",
      "FINISHED",
    ]);
  });

  it("requested status narrows to one", () => {
    assert.deepEqual([...resolveLeagueStatuses("INACTIVE")], ["INACTIVE"]);
    assert.deepEqual([...resolveLeagueStatuses("FINISHED")], ["FINISHED"]);
  });
});

describe("buildLeagueLabel", () => {
  it("joins name, season and age category with an em dash", () => {
    assert.equal(
      buildLeagueLabel({
        name: "لیگ برتر نوجوانان",
        seasonName: "فصل ۱۴۰۵",
        ageCategoryName: "نوجوانان",
      }),
      "لیگ برتر نوجوانان — فصل ۱۴۰۵ — نوجوانان",
    );
  });
});
