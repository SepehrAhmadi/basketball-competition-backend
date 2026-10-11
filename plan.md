# Refactor Plan: `competition/leagues` Module

> Give this whole document to the project AI. Before starting, read `docs/08-conventions.md` and `docs/09-authorization.md`.
>
> **Global rules**
> - All imports use the explicit `.ts` suffix (ESM).
> - All user-facing strings come from `src/language/message.ts` (Persian text). No inline strings.
> - Do **not** change any URL, HTTP method, permission code, or JSON response shape, except where this plan explicitly says so.
> - After every phase: the project must compile (`npx tsc --noEmit`), the server must start, and Swagger (`/docs`) must render without errors.

---

## Target Folder Structure

```
src/modules/competition/
├── shared/                              # rules + mappers shared by future competition modules (games, groups, series)
│   ├── league.rules.ts
│   └── league.mapper.ts
└── leagues/
    ├── leagues.routes.ts                # app side stays together (leagues + league-teams for club managers)
    ├── leagues.controller.ts
    ├── leagues.service.ts
    ├── league-teams.service.ts
    ├── leagues.validation.ts
    ├── leagues.docs.ts
    ├── leagues.policy.ts
    └── admin/
        ├── (shared admin files live here, at the admin root — see 3.3)
        ├── leagues/
        │   ├── leagues.admin.routes.ts
        │   ├── leagues.admin.controller.ts
        │   ├── leagues.admin.service.ts
        │   ├── leagues.admin.validation.ts
        │   └── leagues.admin.docs.ts
        └── league-teams/
            ├── league-teams.admin.routes.ts
            ├── league-teams.admin.controller.ts
            ├── league-teams.admin.service.ts
            ├── league-teams.admin.validation.ts
            └── league-teams.admin.docs.ts
```

**Decisions**
- **App side (non-admin):** stays as is. `leagues.*` keeps covering both leagues and league-team endpoints (register, unregister, candidates, roster add/remove, eligible-teams, `/leagues/me`). No `league-teams.routes/controller/validation/docs` are created for the app.
- **Admin side:** `admin/` is split into two subfolders, `leagues/` and `league-teams/`. Files used by both subfolders stay in the root of `admin/`.
- **`shared/`** stays at the `competition/` level.

---

## Phase 1 — Behavior fixes and bugs (do before moving files)

### 1.1 Fix the 403 on the public `listMembers` endpoint
- **File:** `league-teams.service.ts`
- **Problem:** `GET /leagues/:leagueId/teams/:leagueTeamId/members` is public (`optionalJWT`, `security: []`, "safe fields only"), but `listMembers` uses `loadLeagueTeamForActor`, which throws 403 for anyone who is not an admin or a manager of that organization. Guests and regular users can never read it.
- **Do:**
  - Create `loadLeagueTeam(league, leagueTeamId)`: loads the ACTIVE `leagueTeam` (including `team.id` and `team.organizationId`), throws 404 `leagueTeam.notFound` when missing, **no ownership check**.
  - `loadLeagueTeamForActor` calls `loadLeagueTeam` and then performs the ownership check (403 `league.notAuthorized`).
  - `listMembers` uses `loadLeagueTeam` (no ownership check). `can` is still computed with `leagueTeamPolicy` (all false for guests).
  - `listCandidates`, `addMembers`, `removeMember` keep using `loadLeagueTeamForActor`.
  - `phone` and `birthDate` are returned only when `options.admin === true` (unchanged).
- **Why:** actual behavior must match the route, the Swagger docs, and `docs/modules/competition.md`.

### 1.2 Prevent invalid data in an `ACTIVE` league
- **Files:** `league-teams.service.ts` (`unregisterTeam`, `removeMember`), `leagues.policy.ts`, `message.ts`
- **Problem:** the rule "at least 2 teams, each with at least 1 player" is only checked when switching the status to `ACTIVE`. Afterwards an admin can remove a team or the last player and leave the league in an invalid state.
- **Do:**
  - In `unregisterTeam`: if `league.status === "ACTIVE"`, reject with **409** and a new message key (e.g. `messages.error.league.cannotUnregisterInActive`).
  - In `removeMember`: if `league.status === "ACTIVE"` and the member is a PLAYER and removing them would leave that league team with **0** ACTIVE players, reject with **409** (reuse `league.teamWithoutPlayers` or add a new key).
  - In `leagueTeamPolicy`: for admins, `unregister` must be `false` when `status === "ACTIVE"` so the `can` flag matches the service. `manageRoster` stays as is.
  - Do **not** change `canEditByStatus`.
- **Why:** prevents an ACTIVE league that contradicts its own start conditions.

### 1.3 Remove the redundant branch in `toTeamItem`
- **File:** `league-teams.service.ts`
- **Do:** delete `actor.userId === null && !actor.isAdmin ? {...false} : ...` and call `leagueTeamPolicy(actor, league, row.team.organization.id)` directly (the policy already returns all-false for guests).

### 1.4 Remove the N+1 query in `addMembers`
- **File:** `league-teams.service.ts`
- **Do:** before the loop, run one `leagueTeamMember.findMany` with `status: "ACTIVE"`, `leagueTeam: { leagueId, status: "ACTIVE", id: { not: leagueTeamId } }`, `teamSeasonMember: { role: "PLAYER", userId: { in: playerUserIds } }`, collect conflicting `userId`s in a `Set`, and inside the loop only use `Set.has`. Keep the order and messages of the checks exactly as they are today (age check first, then clash).

### 1.5 Add pagination to `listCandidates` (lower priority)
- **Files:** `league-teams.service.ts`, Swagger docs (app and admin)
- **Do:** apply `skip/take` from `page/pageSize` (`candidatesQuerySchema` already has them), return `total` from a separate `count`, and return `page` and `pageSize`. `selected` and the "in other team" set are computed for the returned page only.

---

## Phase 2 — Deduplicate shared code

### 2.1 Move `adminActor` into `src/authz/actor.ts`
- Define and export `adminActor(callerUserId: number): Actor` in `authz/actor.ts`.
- Delete the copies in `league-teams.service.ts` and `teams/admin/teams.admin.service.ts`; import from `authz/actor.ts`. Remove `adminActor` from the default export of the league-teams service.

### 2.2 Unify the member mappers
- **Files:** `competition/shared/league.mapper.ts`, `league-teams.service.ts`
- **Problem:** `toPublicMemberItem` / `toAdminMemberItem` are unused; the service has its own `toMemberRow`.
- **Do:** delete `toMemberRow`. The service uses the mapper functions (`options.admin` selects which one). Add a small flatten helper (in the mapper) that converts the `memberInclude` shape to the mapper's input. JSON output must not change.

---

## Phase 3 — Move folders

### 3.1 Move files
- `competition/admin/leagues/*` → `competition/leagues/admin/leagues/*`
- `competition/admin/league-teams/*` → `competition/leagues/admin/league-teams/*`
- File names stay the same.
- App files (`competition/leagues/*`) and `competition/shared/*` stay where they are.

### 3.2 Fix imports and registrations
- Update all relative imports (examples: `../../../shared/league.rules.ts` from `admin/leagues/`, `../../../league-teams.service.ts` from `admin/league-teams/`; compute exact depth per file).
- Update `src/routes/index.ts` and `src/swagger/swagger.ts` to the new paths.

### 3.3 Shared admin files stay in the `admin/` root
Only files that are **actually used by both** `admin/leagues/` and `admin/league-teams/` go in the root of `admin/`. Do not create empty or speculative files. Expected candidates:
- `league.admin.shared.validation.ts` — schemas imported by both subfolders (e.g. a re-export of `leagueIdParamSchema` from `../leagues.validation.ts`).
- `league.admin.shared.docs.ts` — Swagger schemas and error responses used by both subfolders (e.g. `unauthorizedError`, `forbiddenError`, `badRequestError`, `conflictError`, and the admin league schema if both docs files need it).
- If after Phase 4 nothing is shared, do not create these files.

---

## Phase 4 — Cleanup after the move

### 4.1 Split admin validation properly
- Move `createLeagueSchema`, `updateLeagueSchema`, `updateLeagueStatusSchema`, `adminLeagueListQuerySchema` (and `nameField`, `descriptionField`, `nullableJalaliDate` if only admin uses them) from `leagues.validation.ts` into `admin/leagues/leagues.admin.validation.ts` as **real definitions**, not re-exports.
- `leagues.validation.ts` keeps only what the app side uses plus `leagueIdParamSchema`.
- `league-teams.admin.validation.ts` may keep re-exporting the truly shared schemas (`leagueTeamParamSchema`, `registerTeamSchema`, ...) from `../../leagues.validation.ts`. This is acceptable.
- Delete unused `z.infer` type exports in admin validation.

### 4.2 Make the admin routers independent
- Move `GET /:leagueId/eligible-teams` out of `leagues.admin.routes.ts` into the league-teams admin routes file (keep `verifyPermission("league-teams.create")`).
- `league-teams.admin.routes.ts` is mounted at `/admin/leagues/:leagueId/teams`. For eligible-teams, export a second router (named export, e.g. `eligibleTeamsRouter`) from the same file and mount it at `/admin/leagues/:leagueId/eligible-teams` in `routes/index.ts`. The final URL must stay `/admin/leagues/:leagueId/eligible-teams`.
- Remove all imports from `league-teams` in `leagues.admin.routes.ts`.
- In `routes/index.ts`, mount `/admin/leagues/:leagueId/teams` and `/admin/leagues/:leagueId/eligible-teams` **before** `/admin/leagues`.

### 4.3 Unify Swagger schemas
- In `leagues.docs.ts` `export`: `leagueSchema`, `leagueMemberSchema`, `leagueTeamItemSchema`, `eligibleTeamSchema`, `leagueCandidateSchema`.
- In admin docs, remove duplicated definitions and derive from those with `.omit()` / `.extend()` and `.openapi("Admin...")` names (same pattern as `organizations.admin.docs.ts`). Differences: no `can` on admin, extra `phone` and `birthDate` on members/candidates.
- Change `createdAt` / `updatedAt` from `z.string()` to `z.date().openapi({ example: "2026-01-01T10:00:00.000Z" })`.
- Update docs for Phase 1: `listMembers` is truly public; `listCandidates` has `page/pageSize/total`; document the new 409s for unregister (ACTIVE) and last-player removal (ACTIVE); the 404 for team-in-league uses `messages.error.leagueTeam.notFound`.

---

## Phase 5 — Project documentation

- `docs/03-project-structure.md`: update the folder tree to the structure above; correct the model count from `schema.prisma` (currently 17 models, not 14).
- `docs/modules/competition.md`: update sub-modules (`leagues/`, `leagues/admin/leagues/`, `leagues/admin/league-teams/`, `shared/`); add the rule "unregistering a team and removing the last player is forbidden in an ACTIVE league"; state that `listMembers` is genuinely public.
- `docs/status/current-state.md` and `docs/status/roadmap.md`: update only if status changed.
- `docs/05-middleware.md`, `docs/09-authorization.md`: fix any direct file paths that moved.

---

## Acceptance Criteria

1. The project compiles and starts; `/docs` renders without errors.
2. All URLs, methods, permissions, and response shapes are unchanged **except**:
   - public `listMembers` no longer returns 403 to non-managers;
   - unregistering a team from an `ACTIVE` league, and removing the last player of a team in an `ACTIVE` league, return 409;
   - `listCandidates` returns `page`, `pageSize`, `total`;
   - `createdAt` / `updatedAt` are date types in Swagger.
3. No duplicate helpers (`adminActor`, `toMemberRow`) and no dead imports/exports remain (verify with a project-wide search).
4. No inline message strings; new messages exist only in `message.ts`.
5. The `admin/` root contains only files genuinely shared by both subfolders.
6. Final report: list of changed/moved files and any decision taken outside this plan.

---

## Execution Order

Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5. Compile and boot the server (open Swagger) after each phase before continuing.