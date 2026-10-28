import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jalaliPatchValue, jalaliToGregorian } from "./date.util.ts";

describe("jalaliPatchValue", () => {
  it("undefined leaves unchanged", () => {
    assert.equal(jalaliPatchValue(undefined), undefined);
  });
  it("null clears", () => {
    assert.equal(jalaliPatchValue(null), null);
  });
  it("valid string converts", () => {
    assert.deepEqual(
      jalaliPatchValue("1399/01/01"),
      jalaliToGregorian("1399/01/01"),
    );
  });
  it("invalid string throws", () => {
    assert.throws(() => jalaliPatchValue("not-a-date"));
  });
});
