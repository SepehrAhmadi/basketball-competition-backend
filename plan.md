# Plan — Stage 1: League Competition Format

Source of truth for decisions: `League competition structure decisions.md`.
This plan covers **only Stage 1** (format settings). Groups, games, standings, brackets and player stats are later stages and are only referenced where Stage 1 must leave a hook for them.

---

## 1. Goal and scope

An admin chooses, per league, the competition structure and scoring rules. The data lives on the existing `League` row; the behavior (endpoints, validation, locks) lives in a new `competition/format` sub-module.

**In scope**
- New enums and new columns on `leagues` + migration.
- `GET` / `PUT` `/admin/leagues/:leagueId/format` (admin panel only).
- Pure rules in `competition/format/lib/format.rules.ts`.
- Two public reference-data endpoints in `shared/` (dropdown labels).
- Messages, Swagger, docs updates, and a fix of the stale docs about admin folders.

**Out of scope (later stages)**
- Groups / group teams (Stage 2), games (Stage 3), standings (Stage 4), brackets / series (Stage 5), player stats (Stage 6).
- Any public (non-admin) format endpoint.
- Frontend work. The admin-panel form is built after Swagger is published, together with Stage 2.
- Automated tests for the format rules (explicitly not wanted).

---

## 2. Decisions locked in

| # | Decision |
|---|---|
| 1 | `leagues/` is untouched structurally. A new parent folder `modules/competition/` is added next to it, with one sub-module per concept. |
| 2 | Dependency direction is one-way: `competition → leagues`. `leagues` never imports from `competition`. |
| 3 | `format` is a **setting on `League`**, not an entity. No new table. Columns live on `leagues`. |
| 4 | File names inside `competition/format/` do **not** carry a `competition` prefix: `format.admin.service.ts`, not `competition-format.admin.service.ts`. |
| 5 | No test files for the format rules. |
| 6 | Admin-only: all files live under `competition/format/admin/`. No public format endpoint now. |
| 7 | Two endpoints on one single resource: `GET` and `PUT` `/admin/leagues/:leagueId/format`. |
| 8 | `PUT` replaces the whole format object. For `KNOCKOUT_ONLY`, `groupRoundType` and `defaultQualifiersPerGroup` are **ignored if sent** and stored as `null`. |
| 9 | `winPoints` / `lossPoints` are always stored. Both are **required** on `PUT`; the DB defaults (2 / 1) only apply to new or not-yet-configured leagues, so the data shape is constant. |
| 10 | No new permission. `leagues.view` for `GET`, `leagues.update` for `PUT`. |
| 11 | Number of groups and per-group qualifier override are **not** part of format (they belong to Stage 2 on `Group`). |
| 12 | Standings, seeds and brackets are never stored (decision doc, sections 4 and 6). Not relevant to Stage 1 but the format columns must not duplicate any computed value. |

---

## 3. Target folder structure

```
src/modules/
  leagues/                                  # unchanged except the small additive edits in section 9
  competition/
    format/
      admin/
        format.admin.routes.ts
        format.admin.controller.ts
        format.admin.service.ts
        format.admin.validation.ts
        format.admin.docs.ts
      lib/
        format.rules.ts                     # pure: constants, value lists, normalization
  shared/
    league-formats/
      league-formats.routes.ts
      league-formats.controller.ts
      league-formats.service.ts
      league-formats.docs.ts
    group-round-types/
      group-round-types.routes.ts
      group-round-types.controller.ts
      group-round-types.service.ts
      group-round-types.docs.ts
```

Notes
- `format/admin/` follows the `leagues/admin/<sub>/` and `age-categories/admin/<sub>/` pattern already used in the repo.
- `format/lib/` holds module-private pure logic (same role as `leagues/lib/`). It has no Prisma import.
- The two `shared/` folders copy the `league-statuses` and `coach-degrees` pattern (public `GET /`, static enum + Persian label).
- No `format.policy.ts`: the lock is a single status check plus (later) a game-existence check. It is computed in the service and returned as `lockReason`. Admin responses have no `can` flag; app endpoints keep the project's `can`-flag convention. If more rules appear, extract a policy then.

---

## 4. Data model changes

### 4.1 `schema.prisma`

New enums:

```prisma
enum LeagueFormat {
  GROUPS_KNOCKOUT
  SINGLE_GROUP_KNOCKOUT
  KNOCKOUT_ONLY
}

enum GroupRoundType {
  ONE_ROUND
  DOUBLE_ROUND
}
```

New fields on `model League`:

```prisma
format                    LeagueFormat?   @map("format")
winPoints                 Int             @default(2) @map("win_points")
lossPoints                Int             @default(1) @map("loss_points")
groupRoundType            GroupRoundType? @map("group_round_type")
defaultQualifiersPerGroup Int?            @map("default_qualifiers_per_group")
```

Rules for the columns
- `format = null` means "structure not configured yet" (the format is set in a separate action after the league is created, because the number of teams is unknown at creation).
- `groupRoundType` and `defaultQualifiersPerGroup` are non-null **only** when `format` is `GROUPS_KNOCKOUT` or `SINGLE_GROUP_KNOCKOUT`.
- `winPoints` / `lossPoints` always have a value.
- For `SINGLE_GROUP_KNOCKOUT`, `defaultQualifiersPerGroup` means the total number of qualifiers (there is one group).

### 4.2 Migration

- Name: `add_league_format_settings`.
- Generated with `npx prisma migrate dev --name add_league_format_settings`, then `npx prisma generate`.
- Expected SQL (MySQL): `ALTER TABLE leagues ADD COLUMN format ENUM(...) NULL, ADD COLUMN win_points INTEGER NOT NULL DEFAULT 2, ADD COLUMN loss_points INTEGER NOT NULL DEFAULT 1, ADD COLUMN group_round_type ENUM('ONE_ROUND','DOUBLE_ROUND') NULL, ADD COLUMN default_qualifiers_per_group INTEGER NULL;`
- Existing leagues get `format = NULL`, `2 / 1` points. No backfill needed.
- Check the generated SQL before applying (only additive columns, nothing dropped).

---

## 5. Pure rules — `format/lib/format.rules.ts`

Mirrors `leagues/lib/league.rules.ts` (const value lists + pure functions, no Prisma, no `AppError`).

Contents
- `LEAGUE_FORMAT_VALUES = ["GROUPS_KNOCKOUT", "SINGLE_GROUP_KNOCKOUT", "KNOCKOUT_ONLY"] as const` and the matching type.
- `GROUP_ROUND_TYPE_VALUES = ["ONE_ROUND", "DOUBLE_ROUND"] as const` and type.
- `isGroupStageFormat(format)`: true for `GROUPS_KNOCKOUT` and `SINGLE_GROUP_KNOCKOUT`.
- `normalizeFormatInput(input)`: takes the validated input and returns exactly the object to persist:
  - requires `winPoints` and `lossPoints` from the validated input (no fallbacks);
  - for `KNOCKOUT_ONLY` forces `groupRoundType = null` and `defaultQualifiersPerGroup = null`, ignoring whatever was sent;
  - for group formats keeps both values.
- `FormatLockReason = "FINISHED" | "HAS_GAMES" | null` (type only; `HAS_GAMES` is wired in Stage 3).

The module that later needs scoring (`standings`) reads the league columns directly; it never re-implements the rules.

---

## 6. Validation — `format.admin.validation.ts`

Imports `swagger/zod-extend.ts` first, uses `z`, `messages`, and the shared `idField` style used in `leagues.validation.ts`.

- `leagueIdParamSchema` is **reused** from `leagues/leagues.validation.ts` (as `league-teams.admin.routes.ts` does). No duplicate.
- `updateFormatSchema` (`z.object({...}).strict()`):

| Field | Rule |
|---|---|
| `format` | required, `z.enum(LEAGUE_FORMAT_VALUES)` |
| `winPoints` | required int, `min(0)`, `max(10)` |
| `lossPoints` | required int, `min(0)`, `max(10)` |
| `groupRoundType` | optional `z.enum(GROUP_ROUND_TYPE_VALUES)` |
| `defaultQualifiersPerGroup` | optional int, `positive()`, `max(64)` |

- Cross-field checks via `.superRefine` (shape-only, no DB):
  - `winPoints > lossPoints` → error on `winPoints` (`messages.error.leagueFormat.winPointsMustExceedLoss`).
  - if `format` is a group format: `groupRoundType` required (`groupRoundTypeRequired`) and `defaultQualifiersPerGroup` required (`qualifiersRequired`).
  - if `format` is `KNOCKOUT_ONLY`: **no error** for the two group fields; they are just ignored later by `normalizeFormatInput`.
- `.strict()` still rejects unknown keys; only the two group fields are tolerated for knockout-only because they are legitimate keys.
- Default export object with `leagueIdParamSchema` and `updateFormatSchema`, same as other validation files.
- Whether `defaultQualifiersPerGroup` is compatible with the real number of teams is a Stage 2 concern (needs groups); it is **not** checked here.

---

## 7. Service — `format.admin.service.ts`

Uses `prisma` directly, `AppError`, `messages`, and `normalizeFormatInput`. It does not call `leagues.admin.service` (that service owns name/cutoff/deadline logic and must not be touched by format changes).

Shared selection: a `formatSelect` const with `id, status, format, winPoints, lossPoints, groupRoundType, defaultQualifiersPerGroup`.

Response mapper `toFormatResponse(row)`:

```
{
  leagueId,
  format,                       // LeagueFormat | null
  winPoints,
  lossPoints,
  groupRoundType,               // null for KNOCKOUT_ONLY / unset
  defaultQualifiersPerGroup,     // null for KNOCKOUT_ONLY / unset
  lockReason: "FINISHED" | "HAS_GAMES" | null
}
```

`lockReason` is the admin lock signal (decision doc, locking rules) so the UI shows the reason, not only an error. The admin response has no `can` key; app endpoints keep `can` flags.

Functions
1. `getFormat(leagueId)`
   - `prisma.league.findUnique({ where: { id: leagueId }, select: formatSelect })`.
   - Missing → `AppError(404, messages.error.league.notFound)`.
   - Returns `toFormatResponse`.
2. `updateFormat(leagueId, input)`
   - Load league (404 first, same order as the rest of the project: 404 before 403/409).
   - Lock check: `status === "FINISHED"` → `AppError(409, messages.error.league.finishedLocked)` (reuses the existing key; consistent with `updateLeague`).
   - `// TODO(Game):` in this same spot, block with `prisma.game.count({ where: { leagueId } }) > 0` → 409 `messages.error.leagueFormat.locked`. Written with a direct Prisma query so `competition/format` does not import from `games`.
   - `// TODO(Group):` when switching to `KNOCKOUT_ONLY` while groups exist, block (Stage 2).
   - `const data = normalizeFormatInput(input)`; `prisma.league.update({ where: { id: leagueId }, data, select: formatSelect })`.
   - `P2025` → 404 `league.notFound`.
   - Returns `toFormatResponse`.

Why not `loadLeagueContext`: it returns only the context fields (no format columns) and would need a second query. A single `findUnique` with `select` is simpler and the admin always has visibility of every status.

Status rules: format may be edited in `INACTIVE`, `REGISTRATION` and `ACTIVE` as long as no game exists; `FINISHED` is always locked here (reopening a finished league stays a `SUPER_ADMIN` status action).

---

## 8. Routes, controller, docs

### 8.1 `format.admin.routes.ts`

```ts
const router = Router({ mergeParams: true });
router.use(verifyJWT);
router.use(verifyAdminLevel("ADMIN", "SUPER_ADMIN"));

router.get("/",
  verifyPermission("leagues.view"),
  validate(formatAdminValidation.leagueIdParamSchema, "params"),
  formatAdminController.get);

router.put("/",
  verifyPermission("leagues.update"),
  validate(formatAdminValidation.leagueIdParamSchema, "params"),
  validate(formatAdminValidation.updateFormatSchema),
  formatAdminController.update);
```

Same middleware order as `league-teams.admin.routes.ts` (JWT → admin level → permission → validate → controller).

### 8.2 `format.admin.controller.ts`

Standard shape used everywhere: `try { ...; return apiResponse.sendResponse(res, 200, messages..., data) } catch (err) { next(err) }`. Reads `Number(req.params.leagueId)` and `(req.validatedBody ?? req.body)`. Exports `{ get, update }`.

### 8.3 `format.admin.docs.ts`

- Tag: `"Admin - League Format"`.
- `leagueFormatSchema` registered with `.openapi("LeagueFormat")` (fields above, including `lockReason`; no `can`).
- Two `registerPath` blocks:
  - `GET /admin/leagues/{leagueId}/format` → 200, 401, 403, 404.
  - `PUT /admin/leagues/{leagueId}/format` → 200, 400, 401, 403, 404, 409 (finished / locked).
- Description of `PUT` states: whole-object replace; group fields ignored for `KNOCKOUT_ONLY`; `winPoints` and `lossPoints` required with `winPoints > lossPoints`.

### 8.4 Mounting — `routes/index.ts`

Add the import and mount **before** `/admin/leagues` (same reason the league-teams routers are mounted before it, so the more specific path wins):

```ts
router.use("/admin/leagues/:leagueId/format", formatAdminRoutes);
```

Add `import "../modules/competition/format/admin/format.admin.docs.ts";` to `swagger/swagger.ts`.

---

## 9. Small additive edits in existing code

1. **League response** (`leagues/lib/league.mapper.ts`, `LeagueRow` + `toLeagueResponse`): add `format`, `winPoints`, `lossPoints`, `groupRoundType`, `defaultQualifiersPerGroup` so the admin/app league screens can see the structure without a second call. Purely additive; `leagues/` reads its own columns, no import from `competition`.
2. **Swagger for the league schema** (`leagues.docs.ts` `leagueSchema`): add the five optional/nullable fields.
3. **`messages` in `language/message.ts`** (all strings Persian, no inline strings in code):
   - `error.leagueFormat.winPointsMustExceedLoss`: «امتیاز برد باید بیشتر از امتیاز باخت باشد»
   - `error.leagueFormat.groupRoundTypeRequired`: «نوع دور مسابقات گروهی الزامی است»
   - `error.leagueFormat.qualifiersRequired`: «تعداد صعودکننده‌ی هر گروه الزامی است»
   - `error.leagueFormat.locked`: «پس از شروع اولین بازی، ساختار لیگ قابل تغییر نیست» (used from Stage 3)
   - `success.leagueFormat.found`: «ساختار لیگ با موفقیت دریافت شد»
   - `success.leagueFormat.updated`: «ساختار لیگ با موفقیت به‌روزرسانی شد»
   - `success.leagueFormats.fetched`: «ساختارهای لیگ با موفقیت دریافت شد»
   - `success.groupRoundTypes.fetched`: «انواع دور مسابقات گروهی با موفقیت دریافت شد»
4. **Dropdown validation / TODO note**: in `leagues.admin.service.ts` the existing `TODO(Game)` stays untouched in Stage 1 (activated in Stage 3).

---

## 10. Shared reference-data endpoints

Copy of the `league-statuses` pattern, public, no auth.

| Endpoint | Response `data` | Labels (Persian) |
|---|---|---|
| `GET /league-formats` | `{ formats: [{ value, label }] }` | `GROUPS_KNOCKOUT` گروهی + حذفی · `SINGLE_GROUP_KNOCKOUT` تک‌گروه + حذفی · `KNOCKOUT_ONLY` فقط حذفی |
| `GET /group-round-types` | `{ roundTypes: [{ value, label }] }` | `ONE_ROUND` یک‌دوره (همه با همه) · `DOUBLE_ROUND` رفت و برگشت |

Implementation per folder: service builds the list from the generated Prisma enum with a `Record<Enum, string>` label map (same as `league-statuses.service.ts`); controller wraps with `apiResponse.sendResponse`; docs register the path with `security: []`; routes expose `GET /`. Mount in `routes/index.ts` and import docs in `swagger/swagger.ts`.

---

## 11. Documentation updates

| File | Change |
|---|---|
| `docs/03-project-structure.md` | Add `competition/format/{admin,lib}` and the two new `shared/` folders. **Fix the stale line** that says leagues admin files are flattened (`leagues.admin.*`); they actually live in `admin/league/` and `admin/league-team/`. |
| `docs/04-data-model.md` | Add the `League` format columns and the two enums; note `format = null` means unconfigured. |
| `docs/modules/leagues.md` | Fix the same flattened-folder statement; mention new read-only fields in the league response. |
| `docs/modules/competition.md` (new) | Purpose, sub-modules (only `format` for now, others "planned"), dependency rule (`competition → leagues`, one-way), responsibilities and the format lock rules. |
| `docs/modules/shared.md` | Add `league-formats` and `group-round-types`. |
| `docs/status/current-state.md` | Add `competition/format` row (Done after implementation) and the two shared rows. |
| `docs/status/roadmap.md` | Mark format done; keep groups → games → standings → brackets → player stats order. |
| `docs/` (copy) | Store the decisions file as `docs/modules/competition-structure.md` so it is available in every future session. |

---

## 12. Implementation order (checklist)

1. Fix stale docs statements (03 and `modules/leagues.md`) — zero-risk first commit.
2. `schema.prisma`: enums + `League` columns → migration → `prisma generate`; review SQL.
3. `message.ts`: add all keys from section 9.
4. `format.rules.ts`.
5. `format.admin.validation.ts`.
6. `format.admin.service.ts` (+ `toFormatResponse`).
7. `format.admin.controller.ts`, `format.admin.routes.ts`.
8. `format.admin.docs.ts`.
9. Mount in `routes/index.ts`; import docs in `swagger/swagger.ts`.
10. Shared `league-formats` and `group-round-types` (4 files each) + mount + docs import.
11. League response additions (mapper + `leagueSchema`).
12. Remaining docs from section 11 (`competition.md`, `shared.md`, `04`, `current-state`, `roadmap`, decisions copy).
13. Manual verification (section 13), then commit.

Each step keeps the app compiling; steps 2–3 can ship alone.

---

## 13. Manual verification (no automated tests)

Run through Swagger at `/docs` as `SUPER_ADMIN` and as an `ADMIN` with and without permissions.

- `GET` on a fresh league → `format: null`, `winPoints: 2`, `lossPoints: 1`, group fields `null`, `lockReason: null`.
- `PUT GROUPS_KNOCKOUT` with `groupRoundType` + `defaultQualifiersPerGroup` → 200, values stored.
- `PUT GROUPS_KNOCKOUT` missing either group field → 400 `path: message`.
- `PUT SINGLE_GROUP_KNOCKOUT` valid → 200.
- `PUT KNOCKOUT_ONLY` with group fields present → 200, both returned as `null`.
- `PUT` without `winPoints` or without `lossPoints` → 400 (both are required).
- `PUT` with `winPoints <= lossPoints` → 400.
- `PUT` with unknown key → 400 (strict).
- `PUT` after switching from group format to `KNOCKOUT_ONLY` then back → group fields were reset to `null`, must be re-sent.
- League in `FINISHED` → `PUT` returns 409; `GET` shows `lockReason: "FINISHED"`.
- Non-existent league → 404 on both.
- No token → 401; admin without `leagues.update` → 403 on `PUT`, `leagues.view` only → 200 on `GET`.
- `GET /league-formats` and `GET /group-round-types` return Persian labels without a token.
- `GET /admin/leagues/:id` (existing endpoint) now includes the new fields and nothing else changed.

---

## 14. Hooks left for later stages

| Stage | What it adds to format |
|---|---|
| 2 – groups | `TODO(Group)` guard: block switching to `KNOCKOUT_ONLY` when groups exist; validate `defaultQualifiersPerGroup` against group sizes where relevant. |
| 3 – games | Activate `HAS_GAMES` lock via `prisma.game.count` (direct Prisma, no import from `games`); `lockReason = "HAS_GAMES"`; activate `TODO(Game)` in `updateLeagueStatus` and `unregisterTeam`. |
| 4 – standings | Reads `winPoints` / `lossPoints` from the league row. |
| 5 – brackets | Reads `format` to know whether a group stage precedes the bracket. |

Dependency chain stays one-way: `format ← groups ← games ← standings ← brackets`, all depending on `leagues/lib`, with the `games ↔ brackets` cycle resolved in Stage 5 by putting series advancement in `brackets/lib`.

---

## 15. Open points (decide before coding, none block steps 1–3)

1. `max` bounds for `winPoints` / `lossPoints` (plan uses 10) and `defaultQualifiersPerGroup` (plan uses 64).
2. Whether to expose the five new fields in the public league response too (plan: yes, additive, read-only).
3. Whether the admin panel needs a separate permission (`competition-format.update`) later; current plan reuses `leagues.update`.