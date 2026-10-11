import { test } from "node:test";
import assert from "node:assert/strict";
import {
  leagueTeamPolicy,
  rosterRowPolicy,
  type LeagueState,
} from "./leagues.policy.ts";
import {
  buildAccess,
  rolesForTeam,
  type LeagueTeamAccess,
  type MyRosterRow,
} from "../shared/league.access.ts";
import type { Actor } from "../../../authz/actor.ts";

const NOW = new Date("2026-06-10T12:00:00Z");
const OPEN = new Date("2026-06-20");
const CLOSED = new Date("2026-06-01");

const league = (
  status: LeagueState["status"],
  rosterDeadline: Date | null = OPEN,
): LeagueState => ({ status, rosterDeadline });

const access = (
  rosterRole: LeagueTeamAccess["rosterRole"],
  ownTeamSeasonMemberId: number | null = null,
): LeagueTeamAccess => ({ rosterRole, ownTeamSeasonMemberId });

const actor = (over: Partial<Actor> = {}): Actor => ({
  userId: 1,
  isAdmin: false,
  managedOrgIds: new Set<number>(),
  memberOrgIds: new Set<number>(),
  memberTeamIds: new Set<number>(),
  membershipFor: () => undefined,
  ...over,
});

test("leagueTeamPolicy: matrix of role x status x deadline", () => {
  const cases: [LeagueTeamAccess["rosterRole"], LeagueState, boolean, boolean][] = [
    ["ADMIN", league("INACTIVE"), false, false],
    ["ADMIN", league("REGISTRATION"), true, true],
    ["ADMIN", league("ACTIVE"), true, false],
    ["ADMIN", league("FINISHED"), false, false],
    ["ADMIN", league("REGISTRATION", CLOSED), true, true],
    ["MANAGER", league("INACTIVE"), false, false],
    ["MANAGER", league("REGISTRATION"), true, true],
    ["MANAGER", league("REGISTRATION", CLOSED), false, false],
    ["MANAGER", league("ACTIVE"), false, false],
    ["MANAGER", league("FINISHED"), false, false],
    ["HEAD_COACH", league("REGISTRATION"), true, false],
    ["HEAD_COACH", league("REGISTRATION", CLOSED), false, false],
    ["HEAD_COACH", league("ACTIVE"), false, false],
    [null, league("REGISTRATION"), false, false],
  ];
  for (const [role, state, manageRoster, unregister] of cases) {
    assert.deepEqual(
      leagueTeamPolicy(state, access(role), NOW),
      { manageRoster, unregister },
      `${role} ${state.status} ${state.rosterDeadline?.toISOString()}`,
    );
  }
});

test("rosterRowPolicy: manager and admin may toggle head-coach rows", () => {
  for (const role of ["ADMIN", "MANAGER"] as const) {
    assert.deepEqual(
      rosterRowPolicy(
        access(role),
        league("REGISTRATION"),
        { teamSeasonMemberId: 1, isHeadCoach: true },
        NOW,
      ),
      { canToggle: true, lockReason: null },
    );
  }
});

test("rosterRowPolicy: head coach rules", () => {
  const state = league("REGISTRATION");
  const hc = access("HEAD_COACH", 10);
  assert.deepEqual(
    rosterRowPolicy(hc, state, { teamSeasonMemberId: 10, isHeadCoach: true }, NOW),
    { canToggle: false, lockReason: "OWN_ROW" },
  );
  assert.deepEqual(
    rosterRowPolicy(hc, state, { teamSeasonMemberId: 11, isHeadCoach: true }, NOW),
    { canToggle: false, lockReason: "MANAGER_ONLY" },
  );
  assert.deepEqual(
    rosterRowPolicy(hc, state, { teamSeasonMemberId: 12, isHeadCoach: false }, NOW),
    { canToggle: true, lockReason: null },
  );
});

test("rosterRowPolicy: nothing is toggleable when roster is closed or role is null", () => {
  const target = { teamSeasonMemberId: 2, isHeadCoach: false };
  assert.equal(
    rosterRowPolicy(access("HEAD_COACH", 1), league("ACTIVE"), target, NOW).canToggle,
    false,
  );
  assert.equal(
    rosterRowPolicy(access(null), league("REGISTRATION"), target, NOW).canToggle,
    false,
  );
  assert.equal(
    rosterRowPolicy(access("MANAGER"), league("REGISTRATION", CLOSED), target, NOW)
      .canToggle,
    false,
  );
});

const row = (over: Partial<MyRosterRow>): MyRosterRow => ({
  leagueId: 1,
  leagueTeamId: 5,
  teamSeasonMemberId: 10,
  role: "COACH",
  isHeadCoach: true,
  seasonId: 7,
  ...over,
});

test("buildAccess: resolution order and season matching", () => {
  assert.equal(buildAccess(actor({ isAdmin: true }), 3, [], 7).rosterRole, "ADMIN");
  assert.equal(
    buildAccess(actor({ userId: null }), 3, [], 7).rosterRole,
    null,
  );
  // manager wins over head coach (D10)
  assert.equal(
    buildAccess(actor({ managedOrgIds: new Set([3]) }), 3, [row({})], 7).rosterRole,
    "MANAGER",
  );
  assert.deepEqual(buildAccess(actor(), 3, [row({})], 7), {
    rosterRole: "HEAD_COACH",
    ownTeamSeasonMemberId: 10,
  });
  // different season, plain coach and player rows do not grant access
  assert.equal(buildAccess(actor(), 3, [row({ seasonId: 8 })], 7).rosterRole, null);
  assert.equal(buildAccess(actor(), 3, [row({ isHeadCoach: false })], 7).rosterRole, null);
  assert.equal(
    buildAccess(actor(), 3, [row({ role: "PLAYER", isHeadCoach: false })], 7).rosterRole,
    null,
  );
});

test("rolesForTeam: HEAD_COACH replaces COACH, ordered MANAGER first", () => {
  assert.deepEqual(
    rolesForTeam(actor({ managedOrgIds: new Set([3]) }), 3, [row({})]),
    ["MANAGER", "HEAD_COACH"],
  );
  assert.deepEqual(rolesForTeam(actor(), 3, [row({ isHeadCoach: false })]), ["COACH"]);
  assert.deepEqual(
    rolesForTeam(actor(), 3, [row({ role: "PLAYER", isHeadCoach: false })]),
    ["PLAYER"],
  );
  assert.deepEqual(rolesForTeam(actor(), 3, []), []);
});
