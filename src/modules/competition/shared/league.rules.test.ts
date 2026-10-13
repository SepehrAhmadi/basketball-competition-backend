import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canEditByStatus,
  isPlayerAgeEligible,
  isRosterWindowOpen,
} from "./league.rules.ts";
import {
  assertRegistrationAllowed,
  initialStatusForDeadline,
} from "./league.lifecycle.ts";

// Characterization tests for pure league rules.
// These pin the behavior the refactor must preserve (plus the approved
// decision that REGISTRATION requires a valid deadline).

test("isRosterWindowOpen: null deadline means open window", () => {
  assert.equal(
    isRosterWindowOpen(null, new Date("2026-06-10T12:00:00Z")),
    true,
  );
});

test("isRosterWindowOpen: today in Tehran is open, tomorrow is closed", () => {
  const deadline = new Date("2026-06-20T12:00:00Z");
  // 2026-06-20T20:00Z is still 2026-06-20 in Tehran (UTC+3:30) -> open.
  assert.equal(
    isRosterWindowOpen(deadline, new Date("2026-06-20T20:00:00Z")),
    true,
  );
  // 2026-06-20T21:00Z is already 2026-06-21 in Tehran -> closed.
  assert.equal(
    isRosterWindowOpen(deadline, new Date("2026-06-20T21:00:00Z")),
    false,
  );
});

test("isRosterWindowOpen: future deadline open, past deadline closed", () => {
  const now = new Date("2026-06-10T12:00:00Z");
  assert.equal(isRosterWindowOpen(new Date("2026-06-20T12:00:00Z"), now), true);
  assert.equal(isRosterWindowOpen(new Date("2026-06-01T12:00:00Z"), now), false);
});

test("canEditByStatus: admin may edit REGISTRATION and ACTIVE only", () => {
  assert.equal(canEditByStatus("REGISTRATION", true), true);
  assert.equal(canEditByStatus("ACTIVE", true), true);
  assert.equal(canEditByStatus("INACTIVE", true), false);
  assert.equal(canEditByStatus("FINISHED", true), false);
});

test("canEditByStatus: non-admin may edit REGISTRATION only", () => {
  assert.equal(canEditByStatus("REGISTRATION", false), true);
  assert.equal(canEditByStatus("ACTIVE", false), false);
  assert.equal(canEditByStatus("INACTIVE", false), false);
  assert.equal(canEditByStatus("FINISHED", false), false);
});

test("isPlayerAgeEligible: missing birth date, too old, eligible", () => {
  const minBirthDate = new Date("2010-01-01T12:00:00Z");
  assert.deepEqual(isPlayerAgeEligible(null, minBirthDate), {
    ok: false,
    reason: "BIRTH_DATE_MISSING",
  });
  assert.deepEqual(
    isPlayerAgeEligible(new Date("2009-12-31T12:00:00Z"), minBirthDate),
    { ok: false, reason: "TOO_OLD" },
  );
  assert.deepEqual(
    isPlayerAgeEligible(new Date("2010-01-01T12:00:00Z"), minBirthDate),
    { ok: true },
  );
  assert.deepEqual(
    isPlayerAgeEligible(new Date("2012-05-05T12:00:00Z"), minBirthDate),
    { ok: true },
  );
});

test("initialStatusForDeadline: null or past deadline is INACTIVE", () => {
  const now = new Date("2026-06-10T12:00:00Z");
  assert.equal(initialStatusForDeadline(null, now), "INACTIVE");
  assert.equal(
    initialStatusForDeadline(new Date("2026-06-01T12:00:00Z"), now),
    "INACTIVE",
  );
  assert.equal(
    initialStatusForDeadline(new Date("2026-06-20T12:00:00Z"), now),
    "REGISTRATION",
  );
});

test("assertRegistrationAllowed: REGISTRATION requires a valid deadline", () => {
  const now = new Date("2026-06-10T12:00:00Z");
  // Decided behavior: empty deadline is rejected, not just past deadlines.
  assert.throws(() => assertRegistrationAllowed(null, now));
  assert.throws(() =>
    assertRegistrationAllowed(new Date("2026-06-01T12:00:00Z"), now),
  );
  assert.doesNotThrow(() =>
    assertRegistrationAllowed(new Date("2026-06-20T12:00:00Z"), now),
  );
});
