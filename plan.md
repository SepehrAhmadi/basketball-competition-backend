# Plan: League Groups (`Group` + `GroupTeam`) and Team Delete Guard

## 1. Goal

Let admins split the registered teams of a league into groups (manual placement), expose the grouping to the app read-only, and make sure removing teams/leagues/formats never leaves inconsistent group data. In the same release, block deleting a team that is registered in an open league.

Everything here uses the shared Advisory system (`Advisory`, `issues: Advisory[]`, nullable `lock`) that is already in the codebase.

---

## 2. Decisions (final)

### Groups

| # | Topic | Decision |
|---|---|---|
| 1 | When groups can be created | Only when the league format is `GROUPS_KNOCKOUT` or `SINGLE_GROUP_KNOCKOUT`. Format `null` or `KNOCKOUT_ONLY` → 409. `SINGLE_GROUP_KNOCKOUT` allows at most one group (409 on the second). |
| 2 | Which teams can be grouped | Only ACTIVE `LeagueTeam` rows of that league whose `Team.status != DELETED` (reuse `activeLeagueTeamWhere`). A league team belongs to at most one group (unique on `leagueTeamId`). |
| 3 | Placement | Manual only. `PUT` assigns or moves (upsert); `DELETE` removes. |
| 4 | Qualifiers | `effective = group.qualifiersOverride ?? league.defaultQualifiersPerGroup`. In `SINGLE_GROUP_KNOCKOUT` the value is the total number of qualifiers of that single group. |
| 5 | Qualifier consistency | Never a hard error. Reported as `WARNING` advisories (`issues`). |
| 6 | Group order | By `id`. No `sortOrder` column. |
| 7 | Editing window | Allowed in `INACTIVE`, `REGISTRATION`, `ACTIVE`. `FINISHED` is always locked (409 `league.finishedLocked`), reported as `lock` advisory. |
| 8 | Unregister a team from a league | Its `GroupTeam` row is hard-deleted in the same transaction (re-registration reactivates the same `LeagueTeam` row, so a leftover row would silently restore the old group). |
| 9 | Delete a group | Allowed; its `GroupTeam` rows are deleted first, teams become unassigned (same transaction). |
| 10 | League promotion (`REGISTRATION` → `ACTIVE`) | Unchanged. Grouping completeness does not affect it. |
| 11 | Format changes while groups exist | → `KNOCKOUT_ONLY` is blocked (409); → `SINGLE_GROUP_KNOCKOUT` is blocked when more than one group exists (409). |
| 12 | Public read | `GET /leagues/:leagueId/groups` (optional JWT) plus a `group` field on the existing league-team detail. Admin-only data (`issues`, `lock`, `qualifiersOverride`, unassigned teams) is never public. |

### Severity rule (added to the Advisory conventions)

`severity` describes the effect on the **action of that endpoint**. All group advisories are `WARNING` because nothing they describe blocks any action today. `lock` on groups is `BLOCKER` because it blocks the edit endpoints right now.

### Team delete guard

| # | Topic | Decision |
|---|---|---|
| 13 | Rule | A team that has an ACTIVE `LeagueTeam` in a league whose status is `REGISTRATION` or `ACTIVE` cannot be deleted (409). Leagues in `INACTIVE` or `FINISHED` do not block deletion. |
| 14 | Applies to | Both `DELETE /teams/:teamId` (manager/admin) and `DELETE /admin/teams/:teamId`. No admin bypass. |
| 15 | After soft delete | `Team.status = DELETED`. `LeagueTeam` and `GroupTeam` rows are untouched, but every group/league-team query already filters `team.status != DELETED`, so the team disappears from lists and counts. Restoring the team brings it back to the same group. |
| 16 | How it is enforced | The rule is a pure function; the service enforces it with `AppError(409)`; `can.delete` and a `lock` advisory are derived from the same function for the UI. Advisory itself never blocks anything. |

---

## 3. Data model

### 3.1 Prisma (`src/prisma/schema.prisma`)

`groups` is a reserved word in MySQL 8, so tables are mapped to `league_groups` / `league_group_teams`.

```prisma
model Group {
  id                 Int      @id @default(autoincrement())
  leagueId           Int      @map("league_id")
  name               String
  qualifiersOverride Int?     @map("qualifiers_override")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  league League      @relation(fields: [leagueId], references: [id])
  teams  GroupTeam[]

  @@unique([leagueId, name])
  @@map("league_groups")
}

model GroupTeam {
  id           Int      @id @default(autoincrement())
  groupId      Int      @map("group_id")
  leagueTeamId Int      @unique @map("league_team_id")
  createdAt    DateTime @default(now()) @map("created_at")

  group      Group      @relation(fields: [groupId], references: [id])
  leagueTeam LeagueTeam @relation(fields: [leagueTeamId], references: [id])

  @@index([groupId])
  @@map("league_group_teams")
}
```

Add back-relations: `League.groups Group[]` and `LeagueTeam.groupTeam GroupTeam?`.

Notes:

- `leagueTeamId @unique` alone is enough: a `LeagueTeam` already belongs to exactly one league, so "one group per team per league" is guaranteed.
- `@@unique([leagueId, name])` prevents duplicate group names in a league (name is normalized in validation, same as league/age-category names).

### 3.2 Migration

`src/prisma/migrations/20261027120000_add_league_groups/migration.sql`:

```sql
CREATE TABLE `league_groups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `league_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `qualifiers_override` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `league_groups_league_id_name_key`(`league_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `league_group_teams` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `group_id` INTEGER NOT NULL,
    `league_team_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `league_group_teams_league_team_id_key`(`league_team_id`),
    INDEX `league_group_teams_group_id_idx`(`group_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `league_groups` ADD CONSTRAINT `league_groups_league_id_fkey` FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `league_group_teams` ADD CONSTRAINT `league_group_teams_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `league_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `league_group_teams` ADD CONSTRAINT `league_group_teams_league_team_id_fkey` FOREIGN KEY (`league_team_id`) REFERENCES `league_teams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
```

---

## 4. Permissions

`src/shared/permissions.ts`:

- New catalog group titled `گروه‌ها`:
  - `groups.view` (مشاهده گروه‌ها), `groups.create` (ایجاد گروه), `groups.update` (ویرایش گروه), `groups.delete` (حذف گروه).
- `CROSS_RESOURCE_DEPENDENCIES`: `"groups.view": ["leagues.view", "league-teams.view"]` (the panel needs the league and its registered teams to render the groups page).
- Route mapping:

| Endpoint | Permission |
|---|---|
| `GET /groups`, `GET /groups/unassigned-teams` | `groups.view` |
| `POST /groups` | `groups.create` |
| `PUT /groups/:groupId` | `groups.update` |
| `PUT` / `DELETE /groups/:groupId/teams/:leagueTeamId` | `groups.update` (placing teams edits the grouping) |
| `DELETE /groups/:groupId` | `groups.delete` |

`expandPermissions` already makes every action permission imply `groups.view`.

---

## 5. Module structure

```
src/modules/competition/groups/
├── admin/
│   ├── groups.admin.routes.ts
│   ├── groups.admin.controller.ts
│   ├── groups.admin.service.ts
│   ├── groups.admin.validation.ts
│   └── groups.admin.docs.ts
├── lib/
│   ├── groups.rules.ts        # pure rules and codes
│   ├── groups.advisories.ts   # code -> Advisory builders
│   ├── groups.access.ts       # league loading + lock/format assertions
│   └── groups.mapper.ts       # Prisma rows -> response shapes
├── groups.routes.ts           # public read
├── groups.controller.ts
├── groups.service.ts
└── groups.docs.ts
```

Dependency direction (one-way, no cycles):

- `groups` imports `format/lib/format.rules.ts` (`isGroupStageFormat`) and `leagues/lib/league.mapper.ts` (`activeLeagueTeamWhere`, `leagueTeamInclude`) and `leagues/leagues.validation.ts` (`leagueIdParamSchema`).
- `format`, `leagues` and `teams` never import `groups`. They read/write group data with direct Prisma queries only (`prisma.group`, `leagueTeam.groupTeam`), the same pattern as `assertCutoffEditable`.

---

## 6. Pure rules (`lib/groups.rules.ts`)

No Prisma, no `AppError`, no Express.

```ts
export const MIN_TEAMS_PER_GROUP = 2;
export const MAX_GROUPS_SINGLE_GROUP_FORMAT = 1;

export type GroupsLockReason = "FINISHED" | null;
export function getGroupsLockReason(status: LeagueStatus): GroupsLockReason;

export type CreateGroupDenial = "FORMAT_NOT_GROUPED" | "SINGLE_GROUP_ONLY";
export function evaluateCreateGroup(
  format: LeagueFormatValue | null,
  existingGroupCount: number,
): { allowed: true } | { allowed: false; reason: CreateGroupDenial };

export function effectiveQualifiers(
  override: number | null,
  leagueDefault: number | null,
): number | null;

export type GroupIssueCode = "GROUP_TOO_SMALL" | "QUALIFIERS_EXCEED_TEAMS";
export function evaluateGroupIssues(input: {
  teamsCount: number;
  qualifiers: number | null;
}): GroupIssueCode[];
```

`evaluateGroupIssues`:

- `GROUP_TOO_SMALL` when `teamsCount < MIN_TEAMS_PER_GROUP`.
- `QUALIFIERS_EXCEED_TEAMS` when `teamsCount >= 2` and `qualifiers !== null` and `qualifiers >= teamsCount` (nobody would be eliminated). Skipped for groups already too small to avoid double warnings.

Format-side rule lives in `competition/format/lib/format.rules.ts` (format owns it, so `format` never imports `groups`):

```ts
export type FormatChangeDenial = "HAS_GROUPS" | "TOO_MANY_GROUPS";
export function evaluateFormatChange(
  nextFormat: LeagueFormatValue,
  groupCount: number,
): { allowed: true } | { allowed: false; reason: FormatChangeDenial };
```

- `KNOCKOUT_ONLY` and `groupCount > 0` → `HAS_GROUPS`.
- `SINGLE_GROUP_KNOCKOUT` and `groupCount > 1` → `TOO_MANY_GROUPS`.

---

## 7. Advisories

### 7.1 Codes and severities

| Where | Field | Code | Severity | Params |
|---|---|---|---|---|
| group | `issues` | `GROUP_TOO_SMALL` | `WARNING` | `groupId`, `name`, `min`, `current` |
| group | `issues` | `QUALIFIERS_EXCEED_TEAMS` | `WARNING` | `groupId`, `name`, `qualifiers`, `current` |
| league-level (groups list) | `issues` | `TEAM_UNASSIGNED` | `WARNING` | `count` |
| groups list / mutation | `lock` | `FINISHED` | `BLOCKER` | `{}` |
| team (list, detail) | `lock` | `IN_OPEN_LEAGUE` | `BLOCKER` | `{}` |

Group issues and `TEAM_UNASSIGNED` are only produced when the league format is a group format; otherwise `issues` is `[]`.

### 7.2 Messages (`src/language/message.ts`)

New entries (the rest of the file is untouched):

- `error.group`: `notFound`, `nameRequired`, `nameExists`, `formatNotGrouped`, `singleGroupOnly`, `teamNotInGroup`, `teamAssignConflict`.
- `error.leagueFormat`: `hasGroups`, `tooManyGroups`.
- `error.team`: `inOpenLeague`.
- `success.group`: `list`, `created`, `updated`, `deleted`, `unassignedList`, `teamAssigned`, `teamRemoved`, `publicList`.
- `advisory.groups`: `finished` (same meaning as `league.finishedLocked`, reuse its text), and parameterized templates:
  - `groupTooSmall: (name: string, min: number) => string`
  - `qualifiersExceedTeams: (name: string, qualifiers: number, teams: number) => string`
  - `teamUnassigned: (count: number) => string`
- `advisory.team.inOpenLeague` (same meaning as `error.team.inOpenLeague`).

Message text follows the same convention already adopted for the existing advisories (reuse the error sentence where the meaning is identical; no inline strings in code).

### 7.3 Builders (`lib/groups.advisories.ts`)

- `buildGroupIssues(group: { id, name, teamsCount, qualifiers }): Advisory<GroupIssueCode>[]`
- `buildUnassignedIssue(count: number): Advisory<"TEAM_UNASSIGNED">[]` (returns `[]` when `count === 0`)
- `buildGroupsLock(reason: GroupsLockReason): Advisory<"FINISHED"> | null`

Codes are owned by this module; `shared/advisory.ts` stays generic.

---

## 8. Validation (`admin/groups.admin.validation.ts`)

- `groupParamSchema`: `{ leagueId, groupId }` (positive coerced ints).
- `groupTeamParamSchema`: `{ leagueId, groupId, leagueTeamId }`.
- `createGroupSchema` (strict): `name` (trim, map Arabic `ي/ك` to Persian `ی/ک`, 2–100 chars, message `group.nameRequired`), `qualifiersOverride` optional, integer, `1..64`, nullable.
- `updateGroupSchema` (strict, at least one field): same fields, all optional; `qualifiersOverride: null` clears the override.
- `unassignedTeamsQuerySchema`: pagination + `search`.
- `leagueIdParamSchema` is reused from `leagues.validation.ts` (admin list route).

Public route validates only `leagueIdParamSchema`.

---

## 9. Access helpers (`lib/groups.access.ts`)

```ts
loadGroupsLeague(leagueId, options?: { hideInactiveFrom?: Actor }): Promise<{
  id, status, format, defaultQualifiersPerGroup
}>
```

- Single query on `League`. 404 `league.notFound` when missing.
- When `hideInactiveFrom` is passed (public endpoint) and the league is `INACTIVE` and the actor is not admin → 404 (mirrors `loadLeagueContext` / `leaguePolicy.view`).

```ts
assertGroupsEditable(league): void       // FINISHED -> AppError 409 league.finishedLocked
loadGroup(leagueId, groupId): Promise<Group>   // 404 group.notFound
loadActiveLeagueTeam(leagueId, leagueTeamId)   // activeLeagueTeamWhere; 404 leagueTeam.notFound
```

Check order for every mutation: league 404 → `FINISHED` 409 → entity 404s → business rules 409.

---

## 10. Response shapes

### 10.1 `GET /admin/leagues/:leagueId/groups` (not paginated)

```json
{
  "league": { "id": 1, "format": "GROUPS_KNOCKOUT", "defaultQualifiersPerGroup": 2 },
  "lock": null,
  "groups": [
    {
      "id": 3,
      "name": "گروه الف",
      "qualifiersOverride": null,
      "qualifiers": 2,
      "teamsCount": 1,
      "issues": [
        { "code": "GROUP_TOO_SMALL", "severity": "WARNING", "message": "...", "params": { "groupId": 3, "name": "گروه الف", "min": 2, "current": 1 } }
      ],
      "teams": [
        { "leagueTeamId": 11, "team": { "id": 5, "name": "عقاب", "logoUrl": null }, "organization": { "id": 2, "name": "باشگاه عقاب" } }
      ]
    }
  ],
  "unassignedCount": 3,
  "issues": [
    { "code": "TEAM_UNASSIGNED", "severity": "WARNING", "message": "...", "params": { "count": 3 } }
  ]
}
```

### 10.2 `GET /admin/leagues/:leagueId/groups/unassigned-teams`

Paginated (`page`, `pageSize`, `search` on team name): `{ items: [{ leagueTeamId, team, organization }], total, page, pageSize }`. Items are ACTIVE league teams (team not `DELETED`) with no `GroupTeam`, ordered by `id`.

### 10.3 Mutations

| Endpoint | Success | Body |
|---|---|---|
| `POST /groups` | 201 | `{ name, qualifiersOverride? }` → full group item (same shape as 10.1 items, `teams: []`) |
| `PUT /groups/:groupId` | 200 | `{ name?, qualifiersOverride? }` → full group item |
| `DELETE /groups/:groupId` | 200 | `{ unassignedCount, issues }` |
| `PUT /groups/:groupId/teams/:leagueTeamId` | 200 | `{ affectedGroups: GroupSummary[], unassignedCount, issues }` |
| `DELETE /groups/:groupId/teams/:leagueTeamId` | 200 | `{ affectedGroups: GroupSummary[], unassignedCount, issues }` |

`GroupSummary = { id, teamsCount, qualifiers, issues }`. `affectedGroups` contains the target group and, when a team was moved from another group, the source group, so the UI can refresh both badges without refetching the whole list. `issues` here is the league-level list (`TEAM_UNASSIGNED`).

### 10.4 Public `GET /leagues/:leagueId/groups`

```json
{
  "format": "GROUPS_KNOCKOUT",
  "groups": [
    {
      "id": 3,
      "name": "گروه الف",
      "qualifiers": 2,
      "teams": [
        { "leagueTeamId": 11, "team": { "id": 5, "name": "عقاب", "logoUrl": "..." }, "organization": { "id": 2, "name": "باشگاه عقاب" } }
      ]
    }
  ]
}
```

- No `issues`, `lock`, `qualifiersOverride`, `unassignedCount`, `can`.
- `groups: []` when the format is not a group format or no group exists.
- Uses `optionalJWT` + `optionalActor` (same as `GET /leagues*`); `INACTIVE` leagues are 404 for non-admins.

### 10.5 League-team detail (existing public endpoint)

`GET /leagues/:leagueId/teams/:leagueTeamId` gains `group: { id, name } | null`.

---

## 11. Admin service behavior (`admin/groups.admin.service.ts`)

- **listGroups**: load league; one `$transaction` for groups (include active `GroupTeam` rows with `leagueTeamInclude`, ordered by `id`) and `unassignedCount` (`leagueTeam.count` with `activeLeagueTeamWhere(leagueId)` + `groupTeam: null`); compute `qualifiers`, `teamsCount`, `issues`; league-level `issues` and `lock`. Issues are `[]` when the format is not grouped.
- **listUnassignedTeams**: as 10.2.
- **createGroup**: load league → `assertGroupsEditable` → `evaluateCreateGroup(format, count)` (map `FORMAT_NOT_GROUPED` → 409 `group.formatNotGrouped`, `SINGLE_GROUP_ONLY` → 409 `group.singleGroupOnly`) → duplicate-name pre-check (409 `group.nameExists`) → create, mapping `P2002` to the same 409.
- **updateGroup**: editable → `loadGroup` → duplicate-name check excluding self → skip the write when nothing changed → update, mapping `P2002`/`P2025`.
- **deleteGroup**: editable → `loadGroup` → one transaction: `groupTeam.deleteMany({ groupId })` then `group.delete`.
- **assignTeam**: editable → `loadGroup` → `loadActiveLeagueTeam` → read current `GroupTeam` for the team → if already in this group return the summary unchanged (idempotent) → otherwise `groupTeam.upsert({ where: { leagueTeamId }, create, update: { groupId } })` (a move is one atomic statement, never delete + create). `P2002` from a concurrent insert → 409 `group.teamAssignConflict`.
- **removeTeam**: editable → `loadGroup` → find `GroupTeam` by `{ leagueTeamId, groupId }` (404 `group.teamNotInGroup`) → delete.

All "summary" responses are built from fresh counts after the write (`group` rows with `_count` of active teams).

Accepted limitation: two simultaneous creates in a `SINGLE_GROUP_KNOCKOUT` league could both pass the count check; admin-only low contention, no extra locking.

---

## 12. Routes and mounting

`admin/groups.admin.routes.ts` (`Router({ mergeParams: true })`, `verifyJWT` then `verifyAdminLevel("ADMIN", "SUPER_ADMIN")`), registered in this order:

1. `GET /` — `groups.view`
2. `GET /unassigned-teams` — `groups.view` (registered before any `/:groupId` route)
3. `POST /` — `groups.create`
4. `PUT /:groupId` — `groups.update`
5. `DELETE /:groupId` — `groups.delete`
6. `PUT /:groupId/teams/:leagueTeamId` — `groups.update`
7. `DELETE /:groupId/teams/:leagueTeamId` — `groups.update`

Each route validates params first, then query/body.

`src/routes/index.ts`:

```ts
router.use("/leagues/:leagueId/groups", groupsRoutes);              // before "/leagues"
router.use("/admin/leagues/:leagueId/groups", groupsAdminRoutes);   // before "/admin/leagues"
```

---

## 13. Changes to existing code

### 13.1 Unregister cleans group membership

`leagues/services/league-teams.service.ts` → `unregisterTeam`: add to the existing `$transaction([...])`:

```ts
prisma.groupTeam.deleteMany({ where: { leagueTeamId } }),
```

Direct Prisma only; no import from `competition`.

### 13.2 Deleting a league removes its groups

`leagues/admin/league/leagues.admin.service.ts` → `deleteLeague`: extend the transaction, in this order:

1. `groupTeam.deleteMany({ where: { group: { leagueId } } })`
2. `group.deleteMany({ where: { leagueId } })`
3. existing `leagueTeamMember.deleteMany`, `leagueTeam.deleteMany`, `league.delete`.

Without this, a league with groups fails with `P2003` (`hasDependents`).

### 13.3 Format guard (replaces `TODO(Group)`)

`competition/format/admin/format.admin.service.ts` → `updateFormat`, after the `FINISHED` check:

```ts
const groupCount = await prisma.group.count({ where: { leagueId } });
const check = evaluateFormatChange(input.format, groupCount);
if (!check.allowed)
  throw new AppError(409, check.reason === "HAS_GROUPS"
    ? messages.error.leagueFormat.hasGroups
    : messages.error.leagueFormat.tooManyGroups);
```

Remove the `TODO(Group)` comment. Update the `PUT` 409 description in `format.admin.docs.ts`.

### 13.4 Public league-team detail

`leagues/services/leagues.service.ts` → `getLeagueTeamDetail`: add `groupTeam: { select: { group: { select: { id: true, name: true } } } }` to the `leagueTeam` query and return `group: leagueTeam.groupTeam?.group ?? null`. Update `leagueTeamDetailSchema` in `leagues.docs.ts`.

### 13.5 Team delete guard and lock

New files in `teams/lib/`:

- `team.rules.ts` (pure):
  ```ts
  export const TEAM_DELETE_BLOCKING_LEAGUE_STATUSES = ["REGISTRATION", "ACTIVE"] as const;
  export type TeamDeleteDenial = "IN_OPEN_LEAGUE";
  export function evaluateTeamDelete(
    leagueStatuses: LeagueStatus[],
  ): { allowed: true } | { allowed: false; reason: TeamDeleteDenial };
  ```
- `team.advisories.ts`: `buildTeamLock(reason): Advisory<"IN_OPEN_LEAGUE"> | null` (`BLOCKER`).
- `team.locks.ts` (Prisma, direct queries, no import from `leagues`):
  - `loadOpenLeagueTeamIds(teamIds: number[]): Promise<Set<number>>` — one query: `leagueTeam.findMany({ where: { teamId: { in }, status: "ACTIVE", league: { status: { in: ["REGISTRATION", "ACTIVE"] } } }, select: { teamId: true } })`.
  - `assertTeamDeletable(teamId)` — uses the same query for one team, runs `evaluateTeamDelete`, throws `AppError(409, messages.error.team.inOpenLeague)`.

Wiring:

| File | Change |
|---|---|
| `teams/teams.service.ts` → `deleteTeam` | After the policy check, call `assertTeamDeletable`. |
| `teams/admin/teams.admin.service.ts` → `adminDeleteTeam` | Same call before the soft delete (no admin bypass). |
| `teams.service.ts` → `listTeams`, `getTeamById`, `updateTeam`, `updateLogo` (and `createTeam`, trivially unlocked) | Compute the lock set once per response (batch for lists) and derive `can.delete = policy.delete && !locked`; add `lock: Advisory \| null` next to `can`. `teamPolicy` itself stays pure and unchanged. |
| `teams.admin.service.ts` → `adminListTeams`, `adminGetTeamById` | Add `lock` (admin responses carry no `can`). |

Restore (`adminRestoreTeam`) is unchanged.

---

## 14. Swagger

- `groups.admin.docs.ts` and `groups.docs.ts` (public), imported in `src/swagger/swagger.ts`.
- Reuse `advisorySchema` from `swagger/advisory.docs.ts`; nullable advisories as `z.union([advisorySchema, z.null()])`; document the possible codes per field.
- Document 400/401/403/404/409 per endpoint (409 reasons: format not grouped, single-group limit, duplicate name, league `FINISHED`, assignment conflict).
- Note in descriptions: "`issues` is always present; an empty array means no issues. All group issues are warnings and never block saving."
- `teams.docs.ts` and `teams.admin.docs.ts`: add `lock` to `teamSchema`/admin responses and a 409 on both delete routes.
- `format.admin.docs.ts`: extend the `PUT` 409 description.
- `leagues.docs.ts`: `group` on the league-team detail schema.

---

## 15. Tests (`tsx --test`)

- `groups.rules.test.ts`: `evaluateCreateGroup` (null, `KNOCKOUT_ONLY`, `SINGLE_GROUP_KNOCKOUT` with 0/1 groups, `GROUPS_KNOCKOUT`), `effectiveQualifiers` (override wins, falls back to default, both null), `evaluateGroupIssues` (0/1/2 teams, qualifiers below/equal/above teams), `getGroupsLockReason`.
- `groups.advisories.test.ts`: every code → severity `WARNING`/`BLOCKER` as specified, message and params; `buildUnassignedIssue(0)` returns `[]`.
- `format.rules.test.ts`: `evaluateFormatChange` for every format × group counts 0/1/2.
- `team.rules.test.ts`: statuses `INACTIVE`/`FINISHED` allowed, `REGISTRATION`/`ACTIVE` denied, mixed list denied, empty list allowed.
- `team.advisories.test.ts`: `IN_OPEN_LEAGUE` → `BLOCKER`.

---

## 16. Documentation updates

| File | Change |
|---|---|
| `docs/04-data-model.md` | `Group`, `GroupTeam` entries and key decisions (one group per league team, hard-deleted on unregister) |
| `docs/03-project-structure.md` | `competition/groups/`; model count |
| `docs/modules/competition.md` | Groups sub-module, responsibilities, endpoints, permissions, relationships (`format ← groups`) |
| `docs/modules/competition-structure.md` | Group decisions and the format-change guards |
| `docs/modules/leagues.md` | Unregister/delete cleanup of groups; `group` field on league-team detail |
| `docs/modules/teams.md` | Delete guard, `lock` advisory, `can.delete` derivation |
| `docs/08-conventions.md` | Severity rule: severity is the effect on the current endpoint's action |
| `docs/status/current-state.md`, `docs/status/roadmap.md` | Groups marked done; team delete guard noted |

---

## 17. Rollout notes for the frontend

- All additions are additive except two behavior changes: `DELETE /teams/:teamId` and `DELETE /admin/teams/:teamId` can now return 409 (`team.inOpenLeague`), and `PUT /admin/leagues/:leagueId/format` can return two new 409 reasons.
- New fields: `lock` on team list/detail responses, `group` on league-team detail.
- Admin panel: groups page (unassigned column + group columns, drag & drop and a "move to…" menu, both calling the same `PUT`/`DELETE`), shared advisory renderer for `issues` and `lock`.
- App: "Groups" tab shown only when the format is a group format and at least one group exists; group chip on the league-team page.

---

## 18. Implementation order

1. Schema + migration + generate client.
2. `permissions.ts`, `message.ts`.
3. `groups.rules.ts`, `groups.advisories.ts`, `evaluateFormatChange`, `team.rules.ts`, `team.advisories.ts` with tests.
4. Admin groups module (validation, access, mapper, service, controller, routes) and mounting.
5. Public groups module and the `group` field on league-team detail.
6. Existing-code integrations: unregister cleanup, delete-league cleanup, format guard.
7. Team delete guard + `lock`/`can.delete` wiring.
8. Swagger and docs.
9. Smoke test through Swagger (checklist below).

---

## 19. Acceptance checklist

- [ ] Groups can only be created in a group format; `SINGLE_GROUP_KNOCKOUT` rejects a second group.
- [ ] Only registered, non-deleted league teams can be placed; a team is in at most one group; moving is a single request and idempotent when repeated.
- [ ] Unregistering a team removes its `GroupTeam`; re-registering starts unassigned.
- [ ] Deleting a group unassigns its teams; deleting a league with groups succeeds.
- [ ] Switching format to `KNOCKOUT_ONLY` with groups, or to `SINGLE_GROUP_KNOCKOUT` with more than one group, returns 409.
- [ ] `FINISHED` leagues reject every group mutation (409) and report `lock`.
- [ ] `issues` is always an array; group warnings never block saving; severities match section 7.
- [ ] Public endpoint exposes no admin-only data and 404s for `INACTIVE` leagues (non-admin).
- [ ] A team in a `REGISTRATION` or `ACTIVE` league cannot be deleted (manager and admin routes, 409); teams in `INACTIVE`/`FINISHED` leagues can; `can.delete` and `lock` agree with the service.
- [ ] Soft-deleted teams vanish from group lists and counts, and return to the same group after restore.
- [ ] Swagger and docs updated; unit tests pass.

---

## 20. Points to confirm before coding

1. **Team delete rule wording:** this plan blocks deletion when the league is `REGISTRATION` or `ACTIVE` (your sentence: "a league that is not inactive and not finished"). An earlier answer of mine described it the other way round; this plan follows your wording.
2. **Finished leagues and deleted teams:** since lists filter `team.status != DELETED`, a team deleted after its league finished would disappear from that finished league's team lists and groups. Confirm this is acceptable.
3. **`QUALIFIERS_EXCEED_TEAMS` boundary:** the warning fires when qualifiers are greater than or equal to the number of teams (nobody is eliminated). Use strictly greater instead if you prefer.
4. **No admin bypass** for the team delete guard.