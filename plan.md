# Stage 3 Plan: Group-Stage Games

Status: draft for review. Re-checked against the current codebase (leagues, format, groups, teams modules) and the agreed decisions in the competition structure document.

---

## 1. Scope

### In scope

- Creating games for group-stage formats only (`GROUPS_KNOCKOUT`, `SINGLE_GROUP_KNOCKOUT`).
- Scheduling: date (`DATE`) and time (`HH:mm`), both optional but set together.
- Status transitions: `LIVE`, `CANCELED`.
- Result entry: normal result or forfeit, which sets the game to `FINISHED`.
- Rescheduling a canceled game through `rescheduledFromGameId`.
- Deleting games that never took place.
- Public read endpoints (app) and admin endpoints (panel).
- Activating locks in earlier modules: `HAS_GAMES` in format, group-membership lock, `TODO(Game)` in league status and league deletion.

### Out of scope (later stages)

- Knockout bracket, series, seeding for knockout-only, round-1 swaps, winner progression (Stage 5).
- Standings and tie-breaks (Stage 4).
- Pairings endpoint (`GET .../games/pairings`), postponed.
- Player stats (Stage 6), game officials and media (Stage 7).
- Tests: deferred. Pure rules are the first candidates when testing starts.

---

## 2. Agreed decisions

| # | Decision |
|---|---|
| D1 | No venue field. Only date and time. |
| D2 | Date and time are separate fields: `scheduledDate` (`DATE`) and `scheduledTime` (`HH:mm` string). Time requires date. |
| D3 | A game past its date does NOT become `FINISHED` automatically. Only an admin result entry finishes a game. Past games without result are flagged with a `RESULT_PENDING` warning. |
| D4 | Games can be created only when the league is `ACTIVE`. |
| D5 | Games can be created only for group-stage formats. Format must be set (not `null`) and grouped. |
| D6 | Result entry uses a separate permission, `games.result`. |
| D7 | Forfeit is stored as `status = FINISHED`, `resultType = FORFEIT`, with scores `0` and `20` written at entry time. |
| D8 | Canceled game stays as history. A replay is a new game, linked by `rescheduledFromGameId`. |
| D9 | `DOUBLE_ROUND` home/away not swapped is a warning, not an error. |
| D10 | `rescheduledFromGameId` is implemented now, with a unique constraint (one replacement per canceled game). |
| D11 | Result of a `FINISHED` game can be edited until the league becomes `FINISHED`. |
| D12 | A finished game can be moved back to `CANCELED` (clears the result in the same transaction). Allowed until league is `FINISHED`. |
| D13 | Finishing a league with unfinished games shows a warning in the admin summary. It does not block the status change. |
| D14 | Knockout-only games are NOT created by the games endpoints. They come from the bracket in Stage 5. |
| D15 | The game record keeps `groupId` nullable, so Stage 5 can add knockout games without a migration that changes existing rows. |

---

## 3. Data model

### Enums

```prisma
enum GameStatus {
  SCHEDULED
  LIVE
  FINISHED
  CANCELED
}

enum GameResultType {
  NORMAL
  FORFEIT
}
```

### Model `Game` (table `games`)

| Field | Type | Notes |
|---|---|---|
| `id` | `Int` autoincrement | PK |
| `leagueId` | `Int` | `league_id`, FK to `leagues` |
| `groupId` | `Int?` | `group_id`, FK to `league_groups`. Always set in Stage 3. Nullable for Stage 5. |
| `homeLeagueTeamId` | `Int` | `home_league_team_id`, FK to `league_teams` |
| `awayLeagueTeamId` | `Int` | `away_league_team_id`, FK to `league_teams` |
| `status` | `GameStatus` | default `SCHEDULED` |
| `scheduledDate` | `DateTime?` `@db.Date` | `scheduled_date`. Stored as UTC-noon, same as other dates in the project. |
| `scheduledTime` | `String?` `@db.VarChar(5)` | `scheduled_time`, format `HH:mm`, Tehran local wall clock |
| `homeScore` | `Int?` | `home_score` |
| `awayScore` | `Int?` | `away_score` |
| `resultType` | `GameResultType?` | `result_type`, set only for `FINISHED` games |
| `forfeitLeagueTeamId` | `Int?` | `forfeit_league_team_id`, FK to `league_teams`, set for forfeits |
| `resultNote` | `String?` `@db.Text` | `result_note`, optional |
| `cancelReason` | `String?` `@db.Text` | `cancel_reason`, optional |
| `rescheduledFromGameId` | `Int?` `@unique` | `rescheduled_from_game_id`, self FK to `games` |
| `createdAt` | `DateTime` | `created_at` |
| `updatedAt` | `DateTime` `@updatedAt` | `updated_at` |

### Relations

- `League.games`, `Group.games` (back-relations).
- `LeagueTeam`: three named back-relations: `GameHome`, `GameAway`, `GameForfeit`.
- `Game.rescheduledFrom` and `Game.rescheduledTo` (one-to-one, named `Reschedule`).

### Indexes

- `leagueId`, `groupId`, `homeLeagueTeamId`, `awayLeagueTeamId`.

### Invariants enforced in services (not in DB)

- `homeLeagueTeamId != awayLeagueTeamId`.
- Both teams belong to the same league, and both are `ACTIVE` in it.
- Both teams belong to `groupId`.
- `scheduledTime` present only when `scheduledDate` is present.
- `homeScore`, `awayScore`, `resultType` are set only when `status = FINISHED`.
- `forfeitLeagueTeamId` is set only when `resultType = FORFEIT`, and it is one of the two teams.
- `rescheduledFromGameId` points to a `CANCELED` game in the same league with the same two teams.

---

## 4. Business rules

### 4.1 Creating a game

Checks run in this order. Each failure stops the request.

1. League not found: 404 `league.notFound`.
2. League is `FINISHED`: 409 `league.finishedLocked`.
3. League is not `ACTIVE`: 409 `game.leagueNotActive`.
4. Format is `null`: 409 `game.formatRequired`.
5. Format is `KNOCKOUT_ONLY`: 409 `game.formatNotGrouped`.
6. Either team is not an `ACTIVE` league team of this league: 404 `leagueTeam.notFound`.
7. Both teams are the same: 400 `game.sameTeam`.
8. Either team has no group: 400 `game.teamNotGrouped`.
9. Teams are in different groups: 400 `game.teamsNotInSameGroup`. `groupId` is derived from the teams and never taken from the client.
10. Pair quota is full: 409 `game.pairLimitReached`.
    - Pair key is unordered (A-B and B-A are the same pair).
    - Canceled games do not count.
    - `ONE_ROUND`: maximum 1 non-canceled game per pair.
    - `DOUBLE_ROUND`: maximum 2 non-canceled games per pair.
11. `rescheduledFromGameId` is present, and it fails any of these: 404 if not found, 409 `game.rescheduleSourceInvalid` if not `CANCELED`, same league and same pair, or already has a replacement (unique constraint also protects this).

Warnings (do not block):

- `GAME_UNSCHEDULED`: no date entered.
- `HOME_AWAY_NOT_SWAPPED`: `DOUBLE_ROUND`, second game has the same home team as the first.
- `OUTSIDE_LEAGUE_PERIOD`: `scheduledDate` is before league `startDate` or after `endDate`.

### 4.2 Scheduling

- `PUT` updates `scheduledDate` and `scheduledTime` only. Teams and group are fixed after creation.
- Date and time must be both set or both cleared.
- Allowed while status is `SCHEDULED` or `LIVE`, and while league is `ACTIVE`.
- Editing the schedule of a `FINISHED` or `CANCELED` game is rejected with 409 `game.scheduleLocked`.

### 4.3 Status transitions

| From | To | Allowed | Effect |
|---|---|---|---|
| `SCHEDULED` | `LIVE` | yes | none |
| `SCHEDULED` | `CANCELED` | yes | sets `cancelReason` if given |
| `LIVE` | `CANCELED` | yes | sets `cancelReason` if given |
| `CANCELED` | any | no | 409 `game.statusLocked` |
| `FINISHED` | `CANCELED` | yes (D12) | clears `homeScore`, `awayScore`, `resultType`, `forfeitLeagueTeamId`, `resultNote` in the same transaction |
| `SCHEDULED` / `LIVE` | `FINISHED` | no | only through result entry |
| `FINISHED` | `SCHEDULED` / `LIVE` | no | 409 `game.statusLocked` |

Every `FINISHED → CANCELED` transition is also allowed only when league status is not `FINISHED`.

### 4.4 Result entry

Endpoint sets the game to `FINISHED` (or updates the result of an already finished game).

Allowed when:

- league is `ACTIVE` (league `FINISHED` returns 409 `league.finishedLocked`),
- game status is `SCHEDULED`, `LIVE`, or `FINISHED` (D11),
- game is not `CANCELED`.

Two body types:

- `NORMAL`: `homeScore` and `awayScore`, non-negative integers, not equal (no ties in basketball). Otherwise 400 `game.scoreInvalid` or `game.tieNotAllowed`.
- `FORFEIT`: `forfeitLeagueTeamId` (must be one of the two teams), optional `resultNote`. The server writes `0` for the forfeiting team and `20` for the other. The client does not send scores for forfeits.

Winner is computed in the mapper from the scores. It is not stored.

### 4.5 Rescheduling

- A replacement is a normal `POST`, with `rescheduledFromGameId` set.
- The source game is not changed by the replacement.
- The source's `rescheduledTo` is shown in its detail response.

### 4.6 Deletion

- Allowed only when status is `SCHEDULED` or `CANCELED`, and the game has no `rescheduledTo` replacement.
- `LIVE` and `FINISHED` cannot be deleted: 409 `game.deleteNotAllowed`.
- A `CANCELED` game with a replacement cannot be deleted: 409 `game.hasReplacement`.

### 4.7 Computed flags

- `RESULT_PENDING` (warning): status is `SCHEDULED` or `LIVE`, `scheduledDate` is before today in Tehran, and there is no result.
- Day comparison uses the Tehran day, the same way `isRosterWindowOpen` does. Time is not compared in Stage 3.

---

## 5. Locks activated in earlier modules

| Module | Service | Change | Error |
|---|---|---|---|
| format | `format.admin.service` | `updateFormat` blocked when league has games. `getFormat` returns `lock` with code `HAS_GAMES`. | 409 `leagueFormat.locked` |
| groups | `groups.admin.service` | Assign, move, remove team from group, and delete group are blocked when the group has games. | 409 `group.hasGames` |
| leagues | `leagues.admin.service` `updateLeagueStatus` | Moving back from `ACTIVE` to `REGISTRATION` or `INACTIVE` is blocked when league has games (replaces the existing `TODO(Game)`). | 409 `league.hasGames` |
| leagues | `leagues.admin.service` `deleteLeague` | Deleting a league with games is blocked (defensive; status rules already block it). | 409 `league.hasGames` |
| leagues | `leagues.admin.service` `updateLeagueStatus` | Warning in summary for unfinished games when moving to `FINISHED` (D13). Shown in games `summary`, not in league response. | warning only |

Notes:

- The `HAS_GAMES` lock is computed with `prisma.game.count({ where: { leagueId } })`. Modules do not import the games module, which keeps the dependency direction `format ← groups ← games`.
- The group lock is per group: `prisma.game.count({ where: { groupId } })`.

---

## 6. Module structure

```
src/modules/competition/games/
├── games.routes.ts                 # public read routes
├── games.controller.ts
├── games.service.ts                # public read service
├── games.validation.ts             # gameIdParamSchema, public list query
├── games.docs.ts                   # public Swagger
├── admin/
│   ├── games.admin.routes.ts
│   ├── games.admin.controller.ts
│   ├── games.admin.service.ts
│   ├── games.admin.validation.ts
│   └── games.admin.docs.ts
└── lib/
    ├── games.rules.ts              # pure rules: transitions, quota, forfeit scores, result checks, RESULT_PENDING
    ├── games.advisories.ts         # builders for warnings and locks
    ├── games.queries.ts            # Prisma include objects
    └── games.mapper.ts             # public and admin response mapping
```

Shared lookups are moved to `src/modules/competition/lib/competition.access.ts` (see section 7).

Dependency direction: `games` may import from `competition/format`, `competition/groups/lib`, `leagues/lib`, and `leagues/leagues.policy`. No other module imports from `games`, except Stage 5 later.

---

## 7. Reuse map (no duplicated code)

| Need | Reuse |
|---|---|
| League id param | `leagueIdParamSchema` from `leagues/leagues.validation.ts` |
| Pagination | `paginationQuerySchema`, `paginatedResponseSchema` from `shared/schemas.validation.ts` |
| Id param pattern | `idParamSchema` style, new `gameIdParamSchema` in the same shape |
| Load league for grouped module | `loadGroupsLeague` (move to `competition/lib/competition.access.ts`) |
| Load active league team | `loadActiveLeagueTeam` (move to `competition/lib/competition.access.ts`) |
| Team include with organization | `leagueTeamWithTeamInclude` from `groups/lib/groups.queries.ts` |
| Active team filter | `activeLeagueTeamWhere` from `leagues/lib/league.mapper.ts` |
| Grouped format check | `isGroupedFormat` from `format/lib/format.rules.ts` |
| League status checks | `isLeagueFinished`, `LEAGUE_STATUS_VALUES` from `leagues/lib/league.rules.ts` |
| Tehran "today" | Same Intl approach as `isRosterWindowOpen` and lifecycle. Add `todayInTehran(now)` to `utils/date.util.ts` and use it there too. |
| Jalali date conversion | `jalaliToGregorian`, `gregorianToJalali`, `jalaliToGregorianOrNull`, `jalaliPatchValue` from `utils/date.util.ts` |
| Advisory shape | `makeAdvisory`, `advisorySchema` |
| Lock and issue arrays | Same convention as groups: `issues: []` always present, `lock` nullable |
| Errors and responses | `AppError`, `apiResponse.sendResponse`, `messages` |
| Middleware | `validate`, `verifyJWT`, `verifyAdminLevel`, `verifyPermission`, `optionalJWT`, `optionalActor` |
| Public file URLs | `getPublicFileUrl` |
| Swagger helpers | `successResponseSchema`, `errorResponseSchema`, `registry.registerPath` |

---

## 8. Shared file changes

- `utils/date.util.ts`: add `todayInTehran(now = new Date()): string` returning `YYYY-MM-DD`.
- `competition/lib/competition.access.ts` (new): `loadGroupsLeague`, `loadActiveLeagueTeam`. Update imports in `groups` to use it.
- `shared/permissions.ts`: new group "بازی‌ها" with `games.view`, `games.create`, `games.update`, `games.result`, `games.delete`. Add to `CROSS_RESOURCE_DEPENDENCIES`:
  - `games.view`: `["leagues.view", "league-teams.view", "groups.view"]`.
- `language/message.ts`: new keys under `error.game`, `success.game`, `advisory.games` (list in section 10).
- `routes/index.ts`: mount before parent routes, following the groups pattern:
  - `router.use("/leagues/:leagueId/games", gamesRoutes)` before `/leagues`.
  - `router.use("/admin/leagues/:leagueId/games", gamesAdminRoutes)` before `/admin/leagues`.
- `swagger/swagger.ts`: import `games.docs.ts` and `games.admin.docs.ts`.
- `prisma/schema.prisma`: enums, model, back-relations.
- New migration after `20261027130000`.
- Docs: `docs/modules/competition.md`, `docs/04-data-model.md`, `docs/status/current-state.md`, `docs/status/roadmap.md`.

---

## 9. Endpoints

### 9.1 Public (app), read only

Both use `optionalJWT` and `optionalActor`. Inactive leagues are hidden from non-admins, as in groups.

| Method | Path | Purpose | Query / notes |
|---|---|---|---|
| GET | `/leagues/:leagueId/games` | List games of a league | `status`, `groupId`, `leagueTeamId` (games of one team), `dateFrom`, `dateTo`, `page`, `pageSize` |
| GET | `/leagues/:leagueId/games/:gameId` | Game detail | Includes `rescheduledFrom` and `rescheduledTo` |

Public response fields: `id`, `status`, `resultType`, `group`, `homeTeam`, `awayTeam`, `scheduledDate` (Jalali), `scheduledTime`, `homeScore`, `awayScore`, `winnerLeagueTeamId`, `forfeitLeagueTeamId`, `resultNote`, `cancelReason`, `rescheduledFrom`, `rescheduledTo`.

Teams carry `leagueTeamId`, `team { id, name, logoUrl }`, and `organization { id, name }`.

No `can`, `lock`, or `issues` in public responses.

### 9.2 Admin (panel)

Base path: `/admin/leagues/:leagueId/games`. Middleware: `verifyJWT`, `verifyAdminLevel("ADMIN", "SUPER_ADMIN")`, then `verifyPermission` per route.

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/` | `games.view` | List with filters, `summary`, league `lock`, per-item `can` and `issues` |
| GET | `/:gameId` | `games.view` | Full detail for the edit screen |
| POST | `/` | `games.create` | Create a group-stage game |
| PUT | `/:gameId` | `games.update` | Update `scheduledDate` and `scheduledTime` |
| PATCH | `/:gameId/status` | `games.update` | `LIVE`, `CANCELED`, or back from `FINISHED` to `CANCELED` (D12). Optional `cancelReason`. |
| PUT | `/:gameId/result` | `games.result` | Enter or edit result. Body is `NORMAL` or `FORFEIT` (section 4.4). |
| DELETE | `/:gameId` | `games.delete` | Delete a `SCHEDULED` or `CANCELED` game without replacement |

Admin list response:

- `items`: games with `can` and `issues`.
- `summary`: counts by status, `resultPending`, and `unfinishedAtFinish` (for D13).
- `lock`: `null` or an advisory with codes `FINISHED`, `LEAGUE_NOT_ACTIVE`, `FORMAT_NOT_SET`, `FORMAT_NOT_GROUPED`. Used to disable the "new game" button with a reason.
- `total`, `page`, `pageSize`.

`can` per game:

- `editSchedule`: status is `SCHEDULED` or `LIVE`, league is `ACTIVE`.
- `enterResult`: status is not `CANCELED`, league is not `FINISHED`.
- `cancel`: status is `SCHEDULED`, `LIVE`, or `FINISHED`, league is not `FINISHED`.
- `delete`: rule from section 4.6.

Admin detail adds: `can`, `issues`, `lock` for the single game (same codes as list, plus `DEPENDENT_STARTED` reserved for Stage 5).

### 9.3 Permission reminders

- `games.result` implies `games.view` through `expandPermissions`.
- A user with `games.update` only can change schedule and status, but cannot enter results.

---

## 10. Messages (`message.ts`)

### `error.game`

- `formatRequired`: "ساختار لیگ هنوز مشخص نشده است"
- `formatNotGrouped`: "بازی فقط در ساختار گروهی قابل ساخت است"
- `leagueNotActive`: "بازی فقط در لیگ فعال قابل ساخت است"
- `sameTeam`: "تیم خانه و میهمان نمی‌توانند یکی باشند"
- `teamNotGrouped`: "هر دو تیم باید در یک گروه باشند"
- `teamsNotInSameGroup`: "تیم‌های این بازی در یک گروه نیستند"
- `pairLimitReached`: "سهمیه‌ی بازی‌های این دو تیم تکمیل شده است"
- `rescheduleSourceInvalid`: "بازی مبدأ برای برگزاری مجدد معتبر نیست"
- `scheduleLocked`: "زمان‌بندی این بازی دیگر قابل تغییر نیست"
- `statusLocked`: "تغییر وضعیت این بازی مجاز نیست"
- `scoreInvalid`: "امتیازها باید عدد صحیح و غیرمنفی باشند"
- `tieNotAllowed`: "در بسکتبال نتیجه‌ی مساوی ثبت نمی‌شود"
- `deleteNotAllowed`: "فقط بازی برنامه‌ریزی‌شده یا کنسل‌شده قابل حذف است"
- `hasReplacement`: "این بازی کنسل‌شده جایگزین دارد و قابل حذف نیست"
- `notFound`: "بازی یافت نشد"
- `dateTimeTogether`: "تاریخ و ساعت باید همزمان وارد شوند"

### `success.game`

- `list`, `found`, `created`, `updated`, `statusUpdated`, `resultSaved`, `deleted`.

### `advisory.games` (short labels for chips)

- `resultPending`: "نتیجه‌ی این بازی هنوز ثبت نشده"
- `unscheduled`: "تاریخ بازی مشخص نشده"
- `homeAwayNotSwapped`: "میزبانی در بازی رفت و برگشت جابه‌جا نشده"
- `outsideLeaguePeriod`: "تاریخ خارج از بازه‌ی لیگ است"
- `leagueNotActive`: "لیگ فعال نیست"
- `formatNotSet`: "ساختار لیگ تعیین نشده است"
- `formatNotGrouped`: "ساختار لیگ گروهی نیست"
- `hasGames`: "این لیگ بازی دارد"
- `unfinishedGames`: "بازی‌های بدون نتیجه در لیگ وجود دارد"
- `dependentStarted` (reserved for Stage 5): "بازی وابسته شروع شده است"

---

## 11. Implementation order

Each step is testable on its own.

1. **Refactor shared lookups.** Move `loadGroupsLeague` and `loadActiveLeagueTeam` to `competition/lib/competition.access.ts`. Update `groups` imports. No behavior change.
2. **Date helper.** Add `todayInTehran` to `date.util.ts`. Optionally switch `isRosterWindowOpen` and lifecycle to use it.
3. **Schema and migration.** Enums, `Game` model, back-relations, indexes, migration.
4. **Pure rules.** `games.rules.ts`: transition table, pair quota with unordered key, forfeit score builder, normal-result validator, `RESULT_PENDING` predicate.
5. **Advisories.** `games.advisories.ts`: warning and lock builders.
6. **Queries and mapper.** `games.queries.ts` and `games.mapper.ts`, public and admin shapes, winner computed in mapper.
7. **Validation.** `games.validation.ts` (public query, id param) and `games.admin.validation.ts` (create, schedule, status, result bodies). Date/time pairing rule in `superRefine`.
8. **Public service, controller, routes.**
9. **Admin service.** Create (ordered checks from 4.1), schedule update, status change, result entry, delete. Each in a transaction when multiple rows change.
10. **Admin controller and routes.** With `verifyPermission` per route.
11. **Permissions.** Catalog group and dependency rules.
12. **Lock activation.** `format.admin.service`, `groups.admin.service`, `leagues.admin.service` (status change and delete), and the `FINISHED` summary warning.
13. **Messages.**
14. **Docs.** `games.docs.ts`, `games.admin.docs.ts`, `swagger.ts`, and module documentation updates.

---

## 12. Open points

1. **Roster changes in ACTIVE leagues with games.** Admins can still edit league rosters in `ACTIVE` leagues. Games do not depend on rosters in Stage 3, so this is allowed for now. Stage 6 (player stats) will reference `LeagueTeamMember`, so a roster change after games will need a rule then.
2. **Time comparison for `RESULT_PENDING`.** Stage 3 compares days only. Same-day games whose time has passed are not flagged. Acceptable for now.
3. **`OUTSIDE_LEAGUE_PERIOD` warning.** Included as a warning. Confirm you want it.
4. **Stage 5 hook.** `DEPENDENT_STARTED` is reserved in the lock vocabulary but not emitted in Stage 3.

---

## 13. Summary of the endpoint list

| Audience | Method and path | Permission |
|---|---|---|
| App | GET `/leagues/:leagueId/games` | none (optional JWT) |
| App | GET `/leagues/:leagueId/games/:gameId` | none (optional JWT) |
| Admin | GET `/admin/leagues/:leagueId/games` | `games.view` |
| Admin | GET `/admin/leagues/:leagueId/games/:gameId` | `games.view` |
| Admin | POST `/admin/leagues/:leagueId/games` | `games.create` |
| Admin | PUT `/admin/leagues/:leagueId/games/:gameId` | `games.update` |
| Admin | PATCH `/admin/leagues/:leagueId/games/:gameId/status` | `games.update` |
| Admin | PUT `/admin/leagues/:leagueId/games/:gameId/result` | `games.result` |
| Admin | DELETE `/admin/leagues/:leagueId/games/:gameId` | `games.delete` |