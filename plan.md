# League Module (App Side) — Teardown and Rebuild Plan

Scope: remove the app-facing part of the `competition/leagues` module and rebuild it from scratch.
The admin side (`/competition/leagues/admin`) must keep working unchanged.

---

## 1. Final Decisions

| # | Decision |
|---|---|
| D1 | The league head coach is the team's head coach (`TeamSeasonMember.isHeadCoach = true`, role `COACH`, status `ACTIVE`) **who has an ACTIVE row in the league roster**. No new column or role. |
| D2 | When a team is registered in a league, its head coach for the league's season is **automatically added** to the league roster. |
| D3 | When the head coach changes at team level (assigned/promoted) while the team is registered in a league in `REGISTRATION`, the new head coach is automatically added to that league roster. |
| D4 | The **manager (or admin) can deactivate** the head coach's league row. After that the head coach loses all league access until re-added by the manager (or re-assigned/re-registered, see D2/D3). |
| D5 | The head coach **cannot toggle their own row**, and cannot toggle any head-coach row. Only manager/admin can. |
| D6 | The head coach **can toggle COACH and PLAYER rows** in the league roster (while the league is in `REGISTRATION` and before the roster deadline). |
| D7 | Regular coaches and players are **view-only**. |
| D8 | `teams` are removed from `GET /leagues/me`. Teams of one league for the current user come from the new `GET /leagues/:leagueId/my-teams`. |
| D9 | Authorization for roster edits is derived from the DB (league roster row), **not** from `loadActor` (which only loads active-season memberships). Policies stay pure; the service loads the facts and passes them in. |
| D10 | A user who is both manager and head coach is treated as **manager** (manager rules win). |

Terminology used below: **roster** = league roster (`LeagueTeamMember`); **team roster** = `TeamSeasonMember`.

---

## 2. What Gets Deleted, Kept, and Rewritten

### 2.1 Delete (app-only)

| File | Reason |
|---|---|
| `competition/leagues/leagues.routes.ts` | Rebuilt. |
| `competition/leagues/leagues.controller.ts` | Rebuilt. |
| `competition/leagues/leagues.service.ts` | Rebuilt (list/detail/me/my-teams). |
| `competition/admin/league-teams/*` (stale duplicate folder) | Dead code. Its service/docs are not mounted/aggregated and its docs import a validation file that does not exist there. |
| All app `registerPath(...)` blocks in `leagues.docs.ts` | Re-registered after rebuild. |

### 2.2 Shared with admin — rewrite in place, keep export names

Admin currently imports these, so they cannot simply be removed:

| File | Admin dependency | Plan |
|---|---|---|
| `leagues/league-teams.service.ts` | `league-teams.admin.service.ts` calls it with `adminActor()` | Rewrite in place; keep every exported function name and parameter order; only add optional behaviour. |
| `leagues/leagues.policy.ts` | used by the service above | Rewrite (new inputs, see §5). |
| `leagues/leagues.validation.ts` | admin validation re-exports `leagueIdParamSchema`, `leagueTeamParamSchema`, etc. | Keep all existing exports; add new ones. |
| `leagues/leagues.docs.ts` | admin docs import `leagueSchema`, `leagueTeamItemSchema`, `leagueMemberSchema`, `leagueCandidateSchema`, `eligibleTeamSchema` | Keep these exported schemas; extend additively. |

### 2.3 Keep as-is

`competition/shared/league.rules.ts`, `competition/shared/league.mapper.ts` (extended), `leagues/admin/**`, Prisma schema (no migration needed), `routes/index.ts` mounts.

### 2.4 Order of work (important)

1. Write admin regression tests against the **current** behaviour (see §10) — before touching anything.
2. Delete app-only files and stale folder.
3. Rebuild (sections 5–8).
4. Run admin tests again; update docs.

---

## 3. Target File Layout

```
src/modules/competition/
├── shared/
│   ├── league.rules.ts              # existing (unchanged)
│   ├── league.mapper.ts             # extended: ordering helpers, myRoles mapper
│   ├── league.access.ts             # NEW: DB loaders (resolve access, head coach lookup)
│   └── league.headcoach.sync.ts     # NEW: auto-add head coach to league rosters
└── leagues/
    ├── leagues.routes.ts            # NEW (rebuilt)
    ├── leagues.controller.ts        # NEW
    ├── leagues.service.ts           # NEW: list, detail, me, my-teams, team detail
    ├── league-teams.service.ts      # REWRITTEN: register, unregister, members, candidates, add/remove
    ├── leagues.policy.ts            # REWRITTEN (pure)
    ├── leagues.validation.ts        # extended
    ├── leagues.docs.ts              # rebuilt
    └── admin/**                     # untouched (except additive response fields)
```

Messages: add keys in `src/language/message.ts` (Persian text, per project convention; keys listed in §9).

---

## 4. Endpoint Map (App Side)

All paths are relative to `/api/v1`. `P` = public with optional token (`optionalJWT` + `optionalActor`), `A` = authenticated (`verifyJWT` + `attachActor`).

Route registration order matters: `/me` must be registered **before** `/:leagueId`.

| # | Method & Path | Auth | Status | Purpose |
|---|---|---|---|---|
| 1 | `GET /leagues` | P | rebuilt | Public list (default excludes `INACTIVE`); `status=REGISTRATION` powers the Competitions page. |
| 2 | `GET /leagues/me` | A | rebuilt, **changed** | Leagues the user is part of (profile page). No teams inside. |
| 3 | `GET /leagues/:leagueId` | P | rebuilt | League details + `can`. |
| 4 | `GET /leagues/:leagueId/my-teams` | A | **new** | Only the teams the user is involved in, with `myRoles` and `can`. |
| 5 | `GET /leagues/:leagueId/eligible-teams` | A | rebuilt | Teams the manager can register. |
| 6 | `POST /leagues/:leagueId/teams` | A | rebuilt, **changed** | Register a team (auto-adds head coach). |
| 7 | `DELETE /leagues/:leagueId/teams/:leagueTeamId` | A | rebuilt | Withdraw a team (manager only). |
| 8 | `GET /leagues/:leagueId/teams` | P | rebuilt | Public list of all teams of a league (optional for UI; no `myRoles`). |
| 9 | `GET /leagues/:leagueId/teams/:leagueTeamId` | P | **new** | Single team-in-league details + `myRoles` + `can`. |
| 10 | `GET /leagues/:leagueId/teams/:leagueTeamId/members` | P | rebuilt, **changed** | Current league roster, server-ordered. |
| 11 | `GET /leagues/:leagueId/teams/:leagueTeamId/members/candidates` | A | rebuilt, **changed** | Toggle list for editing (manager / league head coach). |
| 12 | `POST /leagues/:leagueId/teams/:leagueTeamId/members` | A | rebuilt, **changed** | Toggle ON (bulk). |
| 13 | `DELETE /leagues/:leagueId/teams/:leagueTeamId/members/:memberId` | A | rebuilt, **changed** | Toggle OFF. `memberId` = `LeagueTeamMember.id`. |

Common behaviour for non-admin callers: a league in `INACTIVE` status responds `404` on every endpoint (same as today).

---

## 5. Authorization Model

### 5.1 Facts loaded by the service (DB), then passed to a pure policy

```ts
// competition/shared/league.access.ts
export type RosterRole = "ADMIN" | "MANAGER" | "HEAD_COACH" | null;

export interface LeagueTeamAccess {
  rosterRole: RosterRole;
  // teamSeasonMemberId of the caller's own league-roster row, if any
  ownTeamSeasonMemberId: number | null;
}
```

Resolution order in `resolveLeagueTeamAccess(actor, leagueTeam, league)`:

1. `actor.isAdmin` → `ADMIN` (no query).
2. `actor.managedOrgIds.has(team.organizationId)` → `MANAGER` (no query).
3. Otherwise, one query (league-season based, **not** `memberTeamIds`):

```ts
prisma.leagueTeamMember.findFirst({
  where: {
    leagueTeamId,
    status: "ACTIVE",
    teamSeasonMember: {
      userId: actor.userId,
      role: "COACH",
      isHeadCoach: true,
      status: "ACTIVE",
      seasonId: league.seasonId,
    },
  },
  select: { teamSeasonMemberId: true },
});
```
   Found → `HEAD_COACH`. Not found → `null`.

Guests (`userId === null`) skip the query and get `null`.

### 5.2 Pure policy (`leagues.policy.ts`)

```ts
interface LeagueState { status: LeagueStatus; rosterDeadline: Date | null; }

export function leaguePolicy(actor, league): LeagueCan
// unchanged semantics: view, registerTeam
//  - admin: canEditByStatus(status, true)
//  - user managing >= 1 org: status === REGISTRATION && isRosterWindowOpen(deadline)

export function leagueTeamPolicy(actor, league, access): LeagueTeamCan
// { manageRoster, unregister }

export function rosterRowPolicy(access, league, target): { canToggle; lockReason }
// target = { teamSeasonMemberId, isHeadCoach }
```

`leagueTeamPolicy` rules:

| Role | `manageRoster` | `unregister` |
|---|---|---|
| ADMIN | `canEditByStatus(status, true)` | same and `status !== ACTIVE` |
| MANAGER | `status === REGISTRATION && windowOpen` | same |
| HEAD_COACH | `status === REGISTRATION && windowOpen` | **false** |
| null | false | false |

`rosterRowPolicy` rules (evaluated only if `manageRoster` is true, otherwise `canToggle=false`):

| Target row | ADMIN / MANAGER | HEAD_COACH |
|---|---|---|
| Head-coach row | toggle allowed | locked, `lockReason = "MANAGER_ONLY"` (or `"OWN_ROW"` when it is their own) |
| Any other COACH row | allowed | allowed |
| PLAYER row | allowed | allowed |

`lockReason`: `null | "OWN_ROW" | "MANAGER_ONLY"`. Check `OWN_ROW` first.

### 5.3 Enforcement in mutations (server-side, not only UI)

`addMembers` and `removeMember` must:

1. Load league (404 first), league-team (404), compute `access`.
2. `access.rosterRole === null` → `403 league.notAuthorized`.
3. Window/status check (existing `registrationClosed` / `rosterClosed`) using the role-specific rule above.
4. For every target row, run `rosterRowPolicy`. Any locked row → `403 leagueRoster.headCoachRowManagerOnly`.
5. Existing business rules stay (player age rule, one team per league for players, last-player rule in ACTIVE league, duplicates, etc.).

`403` precedes `409` for window checks only after identity is resolved (keeps the project's "identity → status → window" order).

---

## 6. Auto-Activation of the Head Coach

New helper `competition/shared/league.headcoach.sync.ts`:

```ts
export async function addHeadCoachToLeagueRoster(
  tx: TransactionClient,
  params: { leagueTeamId: number; teamId: number; seasonId: number },
): Promise<void>
// finds the team's ACTIVE head coach for seasonId; upserts LeagueTeamMember ACTIVE.
// No-op when the team has no head coach.

export async function syncHeadCoachToRegistrationLeagues(
  tx: TransactionClient,
  params: { teamId: number; seasonId: number; teamSeasonMemberId: number },
): Promise<void>
// for every ACTIVE LeagueTeam of the team in a league with status REGISTRATION
// whose cutoff.seasonId === seasonId: upsert the row ACTIVE.
```

Trigger points:

| Trigger | Where | Behaviour |
|---|---|---|
| Team registered / re-registered | `league-teams.service.registerTeam` (admin and app both) | Make registration **transactional**: create/reactivate `LeagueTeam`, then `addHeadCoachToLeagueRoster`. |
| Head coach created at team level | `teams.service.addRosterMember` (new row and reactivated row with `isHeadCoach = true`) | `syncHeadCoachToRegistrationLeagues` inside the same transaction. |
| Member promoted to head coach | `teams.service.updateRosterMember` when `effectiveIsHeadCoach && !member.isHeadCoach` | same helper, same transaction. |

Not triggered on demotion: the old head coach's league row stays as an ordinary coach row; their head-coach access disappears automatically because access is derived from `isHeadCoach` at request time.

Not re-triggered after the manager deactivates the row (D4). Only a manager re-toggle, a re-registration, or a new head-coach assignment brings the row back.

Documentation note: `teams.service` gains a function import from `competition/shared` (helper, not service). Update `docs/modules/teams.md` and `docs/modules/competition.md` accordingly.

---

## 7. Endpoint Specifications

### 7.1 `GET /leagues` (public)

Query: `page`, `pageSize`, `status` (`REGISTRATION|ACTIVE|FINISHED`), `seasonId`, `ageCategoryId`, `search`.
Behaviour: same as before (default excludes `INACTIVE`; `can` from `leaguePolicy`).
Response item: `League` (see §8) with `can: { view, registerTeam }`.

### 7.2 `GET /leagues/me` (auth) — changed

Query: `page`, `pageSize`, `status` (`REGISTRATION|ACTIVE|FINISHED`).

A league is included when the user is **either**:
- manager of an organization that has an ACTIVE, non-deleted team registered in it, **or**
- selected in the league roster (`LeagueTeamMember.status = ACTIVE`, `teamSeasonMember.status = ACTIVE`, `teamSeasonMember.userId = me`) of an ACTIVE league team of a non-deleted team.

`INACTIVE` leagues are excluded.

Pagination must happen **in the database** (the old version paginated in memory):

```ts
where: {
  status: query.status ?? { not: "INACTIVE" },
  teams: { some: {
    status: "ACTIVE",
    team: { status: { not: "DELETED" } },
    OR: [
      { team: { organizationId: { in: [...actor.managedOrgIds] } } },
      { members: { some: { status: "ACTIVE",
          teamSeasonMember: { userId, status: "ACTIVE" } } } },
    ],
  } },
}
```
(skip the manager branch when `managedOrgIds` is empty). Then run **one** extra query for the returned league ids to compute `myRoles` and `myTeamsCount`.

Response item:
```json
{
  "league": { "...League fields..." },
  "myRoles": ["MANAGER", "HEAD_COACH"],
  "myTeamsCount": 2
}
```
`myRoles` is the de-duplicated union across the user's teams in that league, values `MANAGER | HEAD_COACH | COACH | PLAYER`. Ordering: `MANAGER, HEAD_COACH, COACH, PLAYER`.
Order of leagues: `id desc`. `teams` is **removed** from this response (D8).

### 7.3 `GET /leagues/:leagueId`

`404` if missing or `INACTIVE` (non-admin). Returns `League` + `can: { view, registerTeam }`.
Frontend rule: show "Add team" **only** when `can.registerTeam === true` (it already combines status, roster deadline, and "manages at least one org").

### 7.4 `GET /leagues/:leagueId/my-teams` (auth) — new

Rules:
- MANAGER: **all** ACTIVE league teams of the organizations they manage.
- Others: only league teams where they have an ACTIVE roster row.
- Union when both apply. Deleted teams excluded. `404` for missing/`INACTIVE` league.

Response:
```json
{
  "league": { "id": 1, "name": "...", "status": "REGISTRATION", "rosterDeadline": "1404/05/20" },
  "items": [
    {
      "leagueTeamId": 5,
      "team": { "id": 12, "name": "...", "logoUrl": "https://..." },
      "organization": { "id": 3, "name": "..." },
      "myRoles": ["MANAGER", "HEAD_COACH"],
      "membersCount": 9,
      "can": { "manageRoster": true, "unregister": true }
    }
  ],
  "total": 1
}
```
No pagination (a person has few teams in one league). `can` uses `leagueTeamPolicy` with the resolved access per team. To avoid N+1: load all of the user's roster rows for the league in one query and build a map `leagueTeamId → { isHeadCoach, role }`.

`myRoles` for a roster row: `HEAD_COACH` if `isHeadCoach`, else `teamSeasonMember.role` (`COACH` or `PLAYER`). `HEAD_COACH` replaces `COACH` for that row.

### 7.5 `GET /leagues/:leagueId/eligible-teams` (auth)

Unchanged logic: ACTIVE teams of ACTIVE organizations the caller manages, having at least one ACTIVE member in the league's season; returns `alreadyRegistered` and `activeRosterCount`. Non-managers get an empty list.

### 7.6 `POST /leagues/:leagueId/teams` (auth)

Body: `{ "teamId": number }` (strict).
Checks (order): league → team (404) → manager of team org (403) → status/window (409) → team & org ACTIVE (400) → season roster exists (400) → not already registered (409).
Behaviour changes: runs in a **transaction**; after creating/reactivating the `LeagueTeam`, calls `addHeadCoachToLeagueRoster` (reactivation still starts with an empty roster, then the head coach is added).
Response: league team item including `id` (= `leagueTeamId`, used by the frontend to redirect to the team page), `membersCount`, and `can`.

### 7.7 `DELETE /leagues/:leagueId/teams/:leagueTeamId` (auth)

Unchanged rules: manager only, not allowed in `ACTIVE` league (409), only before deadline in `REGISTRATION`. Soft-deletes the `LeagueTeam` and its `LeagueTeamMember` rows.

### 7.8 `GET /leagues/:leagueId/teams` (public)

All ACTIVE teams of the league, with `membersCount` and `can`. No `myRoles` (use `my-teams`). Kept for the public/Competitions views.

### 7.9 `GET /leagues/:leagueId/teams/:leagueTeamId` (public) — new

```json
{
  "id": 5,
  "league": { "id": 1, "name": "...", "status": "REGISTRATION", "rosterDeadline": "1404/05/20" },
  "team": { "id": 12, "name": "...", "logoUrl": "..." },
  "organization": { "id": 3, "name": "..." },
  "counts": { "coaches": 2, "players": 9 },
  "myRoles": [],
  "can": { "manageRoster": false, "unregister": false }
}
```
`myRoles` is `[]` for guests and non-involved users. `404` if league/league-team is missing or deleted.

### 7.10 `GET .../members` (public) — changed

Query: `page`, `pageSize`, `role`.
Server ordering (fixed, with pagination):
1. head coach first,
2. `COACH` before `PLAYER`,
3. `jerseyNumber asc` (nulls last, players),
4. `id asc`.

Prisma: `orderBy: [{ teamSeasonMember: { isHeadCoach: "desc" } }, { teamSeasonMember: { role: "asc" } }, { teamSeasonMember: { jerseyNumber: "asc" } }, { id: "asc" }]` (enum order `COACH < PLAYER`; verify null handling on MariaDB and, if needed, sort by `jerseyNumber IS NULL` via raw query or drop jersey from the ordering).

Public safe fields only (`id`, `teamSeasonMemberId`, `userId`, `fullName`, `avatarUrl`, `role`, `jerseyNumber`, `isHeadCoach`). Top-level `can` for the viewer.

### 7.11 `GET .../members/candidates` (auth) — changed

Who may call: `ADMIN`, `MANAGER`, `HEAD_COACH` of that league team. Everyone else `403`. (Coaches/players use `/members`.)

Query: `page`, `pageSize`, `role`, `search`.

Each item:
```json
{
  "leagueTeamMemberId": 31,
  "teamSeasonMemberId": 8,
  "userId": 7,
  "fullName": "...",
  "avatarUrl": "...",
  "role": "PLAYER",
  "jerseyNumber": 10,
  "isHeadCoach": false,
  "selected": true,
  "eligible": true,
  "ineligibleReason": null,
  "canToggle": true,
  "toggleLockReason": null
}
```
- `leagueTeamMemberId` is `null` when `selected` is false. It is the `memberId` for the DELETE call (removes the extra lookup call).
- `eligible` / `ineligibleReason` (`BIRTH_DATE_MISSING | TOO_OLD | IN_OTHER_TEAM`) apply to players only.
- `canToggle` comes from `rosterRowPolicy` AND (`selected` OR `eligible`) — a selected row can always be removed; an unselected ineligible player cannot be added.
- Admin variant additionally returns `phone` and `birthDate` (Jalali).

**Ordering with pagination** (selected first, then head coach, coaches, players):
`selected` is not a column of `TeamSeasonMember`, so use two-phase paging:
1. `S` = count of selected members (ACTIVE rows that match the filters).
2. Page slice `[skip, skip+take)` over the virtual list `selected ++ unselected`:
   - part A: selected rows ordered `isHeadCoach desc, role asc, jerseyNumber asc, id asc` with offset `skip`, limit `min(take, S - skip)` when `skip < S`;
   - part B: unselected rows with the same order, offset `max(0, skip - S)`, limit `take - len(A)`.
3. `total` is the total member count.

### 7.12 `POST .../members` (auth) — changed

Body: `{ "teamSeasonMemberIds": number[] }` (1–50, strict, de-duplicated).
Access and row rules: §5.3. Idempotence: reactivates a previously `DELETED` row, rejects already `ACTIVE` with `409`.
Response: the created/reactivated rows in the public member shape plus `leagueTeamMemberId` mapping (`id`).

### 7.13 `DELETE .../members/:memberId` (auth) — changed

`memberId` = `LeagueTeamMember.id`. Access and row rules: §5.3.
Additional rule: head-coach rows are removable by `MANAGER`/`ADMIN` only (D4/D5). Existing last-player rule in an `ACTIVE` league stays.

---

## 8. Response Models (Swagger)

Register in `leagues.docs.ts`:

| Schema | Fields |
|---|---|
| `League` | existing fields; `can?: LeagueCan` |
| `LeagueCan` | `view`, `registerTeam` |
| `LeagueTeamCan` | `manageRoster`, `unregister` |
| `LeagueRoleEnum` | `MANAGER \| HEAD_COACH \| COACH \| PLAYER` |
| `MyLeague` | `league: League`, `myRoles: LeagueRoleEnum[]`, `myTeamsCount: number` |
| `MyLeagueTeam` | `leagueTeamId`, `team`, `organization`, `myRoles`, `membersCount`, `can` |
| `MyTeamsResponse` | `league` (summary), `items: MyLeagueTeam[]`, `total` |
| `LeagueTeamDetail` | see §7.9 |
| `LeagueMember` | public fields |
| `LeagueCandidate` | see §7.11 (admin extends with `phone`, `birthDate`) |
| `EligibleTeam`, `LeagueTeamItem` | existing, unchanged |

Keep exported names `leagueSchema`, `leagueTeamItemSchema`, `leagueMemberSchema`, `leagueCandidateSchema`, `eligibleTeamSchema` (admin docs import them). Admin docs extend `LeagueCandidate` additively.

Update `docs/modules/competition.md`, `docs/modules/teams.md`, `docs/09-authorization.md` (new policy inputs), `docs/status/current-state.md`.

---

## 9. Messages to Add (`src/language/message.ts`, Persian text)

| Key | Meaning |
|---|---|
| `error.leagueRoster.headCoachRowManagerOnly` | Only the organization manager or an admin can add/remove the head coach in the league roster. |
| `error.leagueRoster.notAuthorized` (or reuse `error.league.notAuthorized`) | Caller cannot edit this team's league roster. |
| `success.leagueTeam.myList` | My teams in this league fetched. |
| `success.leagueTeam.found` | League team fetched. |

Reuse existing keys everywhere else (`registrationClosed`, `rosterClosed`, `playerInOtherTeam`, `ageIneligible`, `teamWithoutPlayers`, …). Keep 403/404 keys stable.

---

## 10. Implementation Phases

**Phase 0 — Safety net**
- Write admin regression tests (supertest) for: register/unregister, candidates, add/remove members, status machine. They must pass before and after.

**Phase 1 — Teardown**
- Delete app-only files and the stale `competition/admin/league-teams` folder.
- Remove app `registerPath` blocks; keep exported schemas used by admin.
- Temporarily unmount `/leagues` in `routes/index.ts` until Phase 4.

**Phase 2 — Core (shared)**
1. `league.access.ts` + rewritten `leagues.policy.ts` (+ unit tests with hand-built actors, no DB).
2. `league.headcoach.sync.ts`.
3. Rewrite `league-teams.service.ts` (transactional register, access resolution, row rules, ordering, `leagueTeamMemberId`).
4. Hook `teams.service` (add/promote head coach) to the sync helper.

**Phase 3 — App services**
- `leagues.service.ts`: `listPublicLeagues`, `getPublicLeague`, `listMyLeagues` (DB-paginated, roles aggregation), `listMyTeams`, `getLeagueTeamDetail`.

**Phase 4 — HTTP layer**
- Validation (`leagueIdParamSchema`, `leagueTeamParamSchema`, `leagueMemberParamSchema`, queries), controller, routes (order: `/me` first), remount, Swagger docs.

**Phase 5 — Docs and cleanup**
- Update docs listed in §8; update `current-state.md`.

---

## 11. Test Matrix

Policy (pure, no DB):
- ADMIN / MANAGER / HEAD_COACH / null × status (`INACTIVE`, `REGISTRATION`, `ACTIVE`, `FINISHED`) × deadline (open/closed) → `manageRoster`, `unregister`.
- `rosterRowPolicy`: head-coach row for manager (allowed), for head coach (`MANAGER_ONLY`), own row (`OWN_ROW`), ordinary coach/player rows.

API:
1. `GET /leagues/me`: manager-only user, player-only user, coach selected vs. not selected (not listed), deactivated head coach (not listed), pagination correctness, `INACTIVE` excluded, `teams` absent.
2. `GET /leagues/:id/my-teams`: manager sees all org teams; player sees only own team; mixed roles union; `404` for `INACTIVE`.
3. Register team → head coach auto-added; team without head coach → empty roster; re-register after unregister → head coach re-added, others not.
4. Promote new head coach at team level during `REGISTRATION` → added to league roster; during `ACTIVE`/`FINISHED` → not added.
5. Manager removes head coach row → head coach gets `403` on candidates/add/remove and the league disappears from their profile; manager can re-add.
6. Head coach: can toggle coach and player rows; `403` when targeting head-coach row or own row; `403` after deadline or outside `REGISTRATION`; cannot unregister the team.
7. Coach/player: `403` on candidates/add/remove; `/members` works.
8. Candidates: ordering (selected → head coach → coaches → players), two-phase pagination boundaries, `leagueTeamMemberId` correctness, `canToggle` for ineligible/selected players.
9. Admin endpoints unchanged (regression suite from Phase 0), plus `leagueTeamMemberId` present in admin candidates.

---

## 12. Edge Cases and Notes

1. **Head coach with no manager action:** a team whose head coach was never toggled by the manager works out of the box (D2). If the team has no head coach, only the manager can edit.
2. **Season mismatch:** access is resolved with the league's season (`cutoff.seasonId`), so a head coach of a non-active season is still recognised.
3. **Team-level removal:** `teams.service.removeRosterMember` already soft-deletes league roster rows (and is blocked with `409` when the league is `ACTIVE`/`FINISHED`). Because a head coach can remove players but removing themselves is governed by team rules, confirm that `cannotRemoveOwnHeadCoach` (only when the coach count is 1) is the behaviour you want.
4. **Frontend contract:** buttons are driven by `can.registerTeam`, `can.manageRoster`, `can.unregister`, and per-row `canToggle` / `toggleLockReason`. The frontend never infers permissions from roles.
5. **Notifications:** none exist; a user removed from a roster simply stops seeing the league on their profile.
6. **No Prisma migration** is required for this plan.
7. **Swagger/permissions:** no new admin permission strings are needed; admin behaviour only gains additive fields and the auto head-coach activation on registration.