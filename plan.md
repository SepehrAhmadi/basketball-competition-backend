# Leagues Module Refactor Plan

## 0. Goals and decisions (already agreed)

| # | Decision |
|---|---|
| D1 | Remove the `competition/` wrapper. The module becomes `src/modules/leagues/` (YAGNI: only one sub-module exists today; games/groups/series can regroup later, it is only an import-path change). |
| D2 | `competition/shared/` becomes `leagues/lib/` (module-private domain logic, not the global `modules/shared`). |
| D3 | The three user-facing services move into `leagues/services/`. Project rule: a module with 3+ services uses a `services/` folder; modules with fewer keep a flat layout. |
| D4 | Rename `leagues.public.service.ts` to `services/leagues.service.ts` (it also holds authenticated reads such as `listMyLeagues`). |
| D5 | Delete `league-teams.admin.validation.ts` (pure re-export, nothing admin-specific). |
| D6 | Add `evaluateUnregister` to `leagues.policy.ts` so unregister logic lives in the policy like the other rules. |
| D7 | `addMembers` not-found error must name the offending ids. |
| D8 | Admin pattern becomes uniform across ALL modules: if an admin operation has no extra logic, the admin controller calls the main service with `adminActor(req.userId)`. An admin service exists only for admin-specific logic. |
| D9 | `removeMember` / `loadAddableRows` error message is chosen from `lockReason`; the silent `.catch(() => undefined)` in `updateLeague` must log. |
| D10 | Cross-module imports are allowed under written rules (section 7). `league.head-coach-sync.ts` stays in `leagues/lib/` and `teams.service` keeps importing it. |
| D11 | Docs updated (section 8). |

Non-goals: no behavior change except the explicit message/log fixes in D6, D7, D9. No schema or migration changes. No route path changes (`/api/v1/...` stays identical).

---

## 1. Target structure

```
src/modules/leagues/
├── leagues.routes.ts
├── leagues.controller.ts
├── leagues.validation.ts
├── leagues.docs.ts
├── leagues.policy.ts
├── services/
│   ├── leagues.service.ts          (was leagues.public.service.ts)
│   ├── league-teams.service.ts
│   └── league-roster.service.ts
├── lib/
│   ├── league.rules.ts
│   ├── league.rules.test.ts
│   ├── league.lifecycle.ts
│   ├── league.types.ts
│   ├── league.access.ts
│   ├── league.mapper.ts
│   ├── league.candidates.ts
│   ├── league.roster-writes.ts
│   ├── league.players.ts
│   └── league.head-coach-sync.ts   (imported by teams.service, see section 7)
└── admin/
    ├── leagues.admin.routes.ts
    ├── leagues.admin.controller.ts
    ├── leagues.admin.service.ts
    ├── leagues.admin.validation.ts
    ├── leagues.admin.docs.ts
    ├── league-teams.admin.routes.ts     (exports default router + eligibleTeamsRouter)
    ├── league-teams.admin.controller.ts
    └── league-teams.admin.docs.ts
```

Notes:
- `admin/leagues/` and `admin/league-teams/` sub-folders are flattened to remove the confusing `leagues/admin/leagues/` nesting. File prefixes (`leagues.admin.*`, `league-teams.admin.*`) keep them distinguishable.
- `league-teams.admin.validation.ts` is deleted. Its routes/docs import from `../leagues.validation.ts` directly.

---

## 2. File move map

Use `git mv` so history is preserved.

| Old path (under `src/modules/competition/`) | New path (under `src/modules/leagues/`) |
|---|---|
| `leagues/leagues.routes.ts` | `leagues.routes.ts` |
| `leagues/leagues.controller.ts` | `leagues.controller.ts` |
| `leagues/leagues.validation.ts` | `leagues.validation.ts` |
| `leagues/leagues.docs.ts` | `leagues.docs.ts` |
| `leagues/leagues.policy.ts` | `leagues.policy.ts` |
| `leagues/leagues.public.service.ts` | `services/leagues.service.ts` |
| `leagues/league-teams.service.ts` | `services/league-teams.service.ts` |
| `leagues/league-roster.service.ts` | `services/league-roster.service.ts` |
| `shared/league.rules.ts` | `lib/league.rules.ts` |
| `shared/league.rules.test.ts` | `lib/league.rules.test.ts` |
| `shared/league.lifecycle.ts` | `lib/league.lifecycle.ts` |
| `shared/league.types.ts` | `lib/league.types.ts` |
| `shared/league.access.ts` | `lib/league.access.ts` |
| `shared/league.mapper.ts` | `lib/league.mapper.ts` |
| `shared/league.candidates.ts` | `lib/league.candidates.ts` |
| `shared/league.roster-writes.ts` | `lib/league.roster-writes.ts` |
| `shared/league.players.ts` | `lib/league.players.ts` |
| `shared/league.head-coach-sync.ts` | `lib/league.head-coach-sync.ts` |
| `leagues/admin/leagues/leagues.admin.routes.ts` | `admin/leagues.admin.routes.ts` |
| `leagues/admin/leagues/leagues.admin.controller.ts` | `admin/leagues.admin.controller.ts` |
| `leagues/admin/leagues/leagues.admin.service.ts` | `admin/leagues.admin.service.ts` |
| `leagues/admin/leagues/leagues.admin.validation.ts` | `admin/leagues.admin.validation.ts` |
| `leagues/admin/leagues/leagues.admin.docs.ts` | `admin/leagues.admin.docs.ts` |
| `leagues/admin/league-teams/league-teams.admin.routes.ts` | `admin/league-teams.admin.routes.ts` |
| `leagues/admin/league-teams/league-teams.admin.controller.ts` | `admin/league-teams.admin.controller.ts` |
| `leagues/admin/league-teams/league-teams.admin.docs.ts` | `admin/league-teams.admin.docs.ts` |
| `leagues/admin/league-teams/league-teams.admin.validation.ts` | **deleted** |

---

## 3. Import updates (outside the module)

| File | Change |
|---|---|
| `src/routes/index.ts` | Update the 4 league imports to `../modules/leagues/leagues.routes.ts`, `../modules/leagues/admin/leagues.admin.routes.ts`, and `../modules/leagues/admin/league-teams.admin.routes.ts` (default + `eligibleTeamsRouter`). Mount paths do not change. |
| `src/swagger/swagger.ts` | Update the 3 docs imports: `leagues.docs.ts`, `admin/leagues.admin.docs.ts`, `admin/league-teams.admin.docs.ts`. |
| `src/server.ts` | `startLeagueLifecycleJob` from `./modules/leagues/lib/league.lifecycle.ts`. |
| `src/modules/teams/teams.service.ts` | `syncHeadCoachToRegistrationLeagues` from `../leagues/lib/league.head-coach-sync.ts`. |

Inside the module, all relative paths need re-basing (the depth changes). Key edges:

- `services/*` import `../lib/*`, `../leagues.policy.ts`, and the global `../../../...` utilities (one level deeper than before, depth stays the same as old `leagues/` files plus one for `services/`; verify with the compiler).
- `leagues.policy.ts` imports `./lib/league.rules.ts` and `./lib/league.types.ts`.
- `lib/league.candidates.ts` and `lib/league.roster-writes.ts` import `../leagues.policy.ts`. This is an import in both directions between `lib` and the module root (policy to rules, candidates to policy). It is not a file-level cycle (rules never import policy), but keep it that way: **`lib/league.rules.ts` and `lib/league.types.ts` must never import `leagues.policy.ts`.**
- Admin files import `../services/*`, `../leagues.validation.ts`, `../leagues.docs.ts`, `../lib/*`.

Validation after moving (section 9) will catch any missed path.

---

## 4. Policy change: `evaluateUnregister`

File: `leagues.policy.ts`.

1. Extend `Denial` with `"UNREGISTER_IN_ACTIVE"`.
2. Add:

```ts
/**
 * Single source for "may this actor unregister a team?".
 * Order: identity (403) → ACTIVE league (409) → shared status/window rule.
 * Head coaches are rejected at the identity step.
 */
export function evaluateUnregister(
  actor: Actor,
  league: LeagueState,
  organizationId: number,
  now?: Date,
): Evaluation {
  if (!actor.isAdmin && !actor.managedOrgIds.has(organizationId))
    return { allowed: false, reason: "NOT_AUTHORIZED" };
  if (league.status === "ACTIVE")
    return { allowed: false, reason: "UNREGISTER_IN_ACTIVE" };
  return evaluateRegister(actor, league, organizationId, now);
}
```

3. `throwDenial`: add `case "UNREGISTER_IN_ACTIVE": throw new AppError(409, messages.error.league.cannotUnregisterInActive);`
4. `leagueTeamPolicy`: for `ADMIN`, keep `unregister: allowed && league.status !== "ACTIVE"` (unchanged output; comment that it mirrors `evaluateUnregister`).
5. `services/league-teams.service.ts` `unregisterTeam`: replace the two manual checks and the `assertCanRegister` call with:

```ts
const result = evaluateUnregister(actor, league, leagueTeam.team.organizationId);
if (!result.allowed) throwDenial(result.reason);
```

Behavior preserved: head coach and other non-managers get 403, ACTIVE league gives 409 `cannotUnregisterInActive` (admin included), otherwise the usual status/window 409s.

Tests to add (new file `leagues.policy.test.ts`): matrix for `evaluateUnregister` (admin / manager / head coach / guest x INACTIVE / REGISTRATION / ACTIVE / FINISHED x window open/closed).

---

## 5. Message and logging fixes

### 5.1 `addMembers`: name the missing ids (D7)

File: `lib/league.roster-writes.ts`, `loadAddableRows`.

```ts
if (rows.length !== ids.length) {
  const found = new Set(rows.map((r) => r.id));
  const missing = ids.filter((id) => !found.has(id));
  throw new AppError(
    404,
    `${messages.error.leagueRoster.teamMemberNotFound}: ${missing.join(", ")}`,
  );
}
```

`messages` stays a constant-string object; only the ids are appended (same pattern as the `validate` middleware's `path: message`). Update the Swagger 404 description to say the ids are listed.

### 5.2 Lock-reason-aware 403 message (D9)

Problem: both `removeMember` and `loadAddableRows` always use `headCoachRowManagerOnly`, which is misleading for `OWN_ROW`.

1. Add to `src/language/message.ts` under `error.leagueRoster`:
   `ownRowLocked: "سرمربی نمی‌تواند ردیف خودش را در راستر لیگ تغییر دهد"`
2. Add a small helper next to the policy (pure):

```ts
export function lockReasonMessage(reason: LockReason): string {
  return reason === "OWN_ROW"
    ? messages.error.leagueRoster.ownRowLocked
    : messages.error.leagueRoster.headCoachRowManagerOnly;
}
```

3. In `removeMember` and `loadAddableRows`, replace the hardcoded message with `lockReasonMessage(decision.lockReason)`.

### 5.3 Do not swallow lifecycle errors (D9)

File: `admin/leagues.admin.service.ts`, `updateLeague`.

```ts
await advanceLeagueIfExpired(updated.id).catch((err) =>
  console.error("[league-lifecycle] advanceLeagueIfExpired failed", err),
);
```

The project has no logger (`LOG_LEVEL` exists in `.env.example` but is unused), so `console.error` matches `league.lifecycle.ts`.

---

## 6. Admin pattern unification (D8)

**Rule:** if an admin endpoint adds no logic beyond what the main service already does, the admin controller calls the main service with `adminActor(req.userId!)`. An admin service is created only for admin-specific logic (different filters, different validation, restore, status workflows, etc.).

Audit of every module:

| Module | Finding | Action |
|---|---|---|
| leagues (`league-teams.admin`) | Already direct, no service. | None. |
| leagues (`leagues.admin.service`) | Real admin logic (CRUD, status machine). | Keep. |
| teams | `teams.admin.service` has 3 pure wrappers: `adminAddRosterMember`, `adminUpdateRosterMember`, `adminRemoveRosterMember`. | **Remove wrappers**; controller calls `teamsService.*` with `adminActor(req.userId!)`. Remove the `teamsService` and `adminActor` imports from `teams.admin.service.ts`. Keep list/get/create/update/delete/restore/`adminGetRoster` (real admin logic). |
| organizations | `organizations.admin.service` has independent logic (managerId, status, restore). | None. |
| people / users | `users.admin.service.updateUserByAdmin` is a pure wrapper over `applyProfileUpdate`; `getUserById` is a duplicate of `user.service.getUserById`. Other methods (create, delete, reset password, admin status, permissions, list with hidden admins) are real logic. | **Remove** `updateUserByAdmin` and `getUserById` from `users.admin.service.ts`. `users.admin.controller` calls `applyProfileUpdate` (named export) and `userService.getUserById` directly. `assertTargetAccessible` stays in the admin service and is still called first. |
| age-categories | Admin-only module, no user-facing counterpart. | None. |
| seasons | No admin folder; mutations gated by permissions in the same router. | None. |

Controller change for teams (`teams.admin.controller.ts`):

```ts
import teamsService from "../teams.service.ts";
import { adminActor } from "../../../authz/actor.ts";
// ...
const member = await teamsService.addRosterMember(
  Number(req.params.teamId), input, adminActor(req.userId as number));
```

(same for update/remove). Behavior is identical; only the call chain is shorter.

---

## 7. Cross-module import rules (D10)

Existing cross-module imports in the codebase: `teams.service` imports `organizations.policy` and the league head-coach sync; `auth.service` imports `user.service`; `users.admin.service` imports `user.service`; `teams.admin.service` imports `teams.service`. The convention below makes these legitimate and uniform:

1. A module may import from another module's **service, policy, or lib** file. Never from its routes, controller, or docs.
2. Dependencies are **one-directional**. No cycles (leagues never imports `teams.service`; teams imports leagues' `lib`).
3. Cross-module imports are listed in the "Relationships" section of that module's doc.
4. Code that other modules import should live in `lib/` (or the main service) and be named in the docs. Today the only such file is `leagues/lib/league.head-coach-sync.ts`.

Why `head-coach-sync` stays: it runs inside the team's Prisma transaction (`tx`), so moving it behind an event/hook would break atomicity. Moving it into `teams` only inverts the dependency while the code still queries `league*` tables.

---

## 8. Documentation updates (D11)

| Doc | Change |
|---|---|
| `docs/03-project-structure.md` | Replace `competition/...` line with `leagues/` (`services/`, `lib/`, `admin/`); add a short note on the 3+ services rule. |
| `docs/08-conventions.md` | Add: (a) `services/` folder when a module has 3+ services; (b) `lib/` for module-private logic, with the cross-module import rules from section 7; (c) admin pattern rule from section 6; (d) `*.admin.validation.ts` exists only when it contains admin-specific schemas. |
| `docs/modules/competition.md` | Rename to `docs/modules/leagues.md`; update sub-module section and file names (`services/leagues.service.ts`, `lib/*`, flattened `admin/`); mention `evaluateUnregister`; relationships: add "teams imports `lib/league.head-coach-sync.ts`". |
| `docs/09-authorization.md` | Update the league paragraph (`leagueTeamPolicy`, `rosterRowPolicy`, `evaluateUnregister`) and paths. |
| `docs/02-architecture.md` | Add one line on the admin pattern and cross-module import rules. |
| `docs/modules/teams.md` | Admin roster mutations now call `teams.service` directly with `adminActor`; update the head-coach-sync import path. |
| `docs/modules/people.md` | `users.admin.service` no longer has `updateUserByAdmin` / `getUserById`; admin controller delegates to `user.service`. |
| `docs/modules/shared.md`, `docs/status/*`, `docs/04-data-model.md` | Update any `competition` path references (search for `competition`). |

---

## 9. Execution order

1. **Branch**, make sure the working tree is clean, run `npx tsc --noEmit` and `npm test` to record a green baseline.
2. **Move files** (section 2) with `git mv`; create `services/`, `lib/`, `admin/`; delete `league-teams.admin.validation.ts`.
3. **Fix imports** inside the module, then outside (section 3). Run `npx tsc --noEmit` until clean. (`tsx` does not type-check, so the compiler run is mandatory.)
4. **Rename** `leagues.public.service` to `services/leagues.service.ts` and update the controller import. (Rename the object/import alias consistently.)
5. **Policy**: add `evaluateUnregister`, `UNREGISTER_IN_ACTIVE`, `lockReasonMessage` (section 4, 5.2); update `unregisterTeam`.
6. **Messages and logging**: sections 5.1, 5.2 (new message key), 5.3.
7. **Admin unification**: teams (wrappers removed, controller updated), users (wrapper and duplicate removed). Section 6.
8. **Tests**: keep `league.rules.test.ts`; add `leagues.policy.test.ts` (unregister + roster-row matrix) and a test for `evaluateActiveRequirements` / `initialStatusForDeadline`.
9. **Docs** (section 8).
10. **Verify**:
    - `npx tsc --noEmit` and `npm test` are green.
    - Server boots; `/docs` (Swagger) renders all league, admin-league and admin-league-team paths (a wrong docs import silently drops paths).
    - Smoke test: public `GET /leagues`; admin create league, register team, add members; manager unregister in REGISTRATION (OK) and ACTIVE (409); head coach removing own row (403 with the new message); `addMembers` with a bad id (404 listing the id); teams admin roster add/update/remove; admin users update and get-by-id.
    - Search the repo for leftover `competition` references: `grep -rn "competition" src docs`.
11. Commit in small steps (moves alone first, then behavior changes) so the move diff stays reviewable.

---

## 10. Risks and notes

- **Import depth errors** are the main risk of the move; the compiler catches them.
- **Swagger registration** relies on side-effect imports in `swagger.ts`; verify paths load (section 9, step 10).
- **No behavior change** except: clearer 403 message for own-row lock, ids in the 404 message, logged lifecycle errors. Frontend should be told about the 404 message format change (ids appended after a colon).
- `lib/` to `leagues.policy.ts` import direction is intentional (see section 3); do not let `league.rules.ts` or `league.types.ts` import the policy.
- Known follow-ups, not in this plan: shared constant/filter for "team eligible for registration" (`listEligibleTeams` vs `registerTeam`), merging `LeagueTeamStatus` and `LeagueTeamMemberStatus` enums, splitting `league.mapper.ts` into includes and mappers if it grows, a multi-instance-safe scheduler if the API is ever run with more than one process.