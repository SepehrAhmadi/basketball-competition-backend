# Backend Plan: Competition Page Support

Status: ready for implementation.
Pairs with `frontend-competition-games-ui-plan.md`. The frontend plan depends on everything in this document, so implement this plan first.

Scope: small backend changes the admin competition page needs for the games UI:

1. A page-level permission `competition.view`, with dependency rules and dependency-aware permission assignment.
2. Two admin dropdown endpoints (league groups, league teams) for the games filters and forms.
3. Two new filters on the games list (`search`, `resultPending`).
4. Game counts on admin group items.

Out of scope: tests (deferred), the pairings endpoint, standings and brackets, any frontend work.

Assumption: the "v3 small" fixes are applied, so the shared list query schema is named `gamesListQuerySchema`. If that rename was not applied, use the current name (`publicGamesQuerySchema`) wherever this plan says `gamesListQuerySchema`.

---

## 1. Decision log

| # | Decision |
|---|---|
| P1 | New permission `competition.view`: entering the competition page and seeing the league structure card. It implies `leagues.view`. |
| P2 | `groups.view` and `games.view` depend on `competition.view` (so granting either one grants the page permission automatically). `games.view` already depends on `groups.view`. |
| P3 | The permission catalog endpoint returns, for every permission, its direct prerequisites (`requires`), computed from the same rules the server enforces. The frontend never duplicates dependency rules. |
| P4 | Saving a user's permissions stores the dependency-expanded set (what is stored equals what is effective). Existing rows are not migrated. |
| P5 | Game filters and the game form use dedicated dropdown endpoints (not the list endpoints): `GET /dropdowns/admin/league-groups` and `GET /dropdowns/admin/league-teams`. Both are admin-level only (same gate as `/dropdowns/admin/leagues`). |
| P6 | Games list gets `search` (team name, shared by public and admin) and `resultPending` (admin only). |
| P7 | Admin group items carry `gamesCount` (non-canceled games) and `finishedGamesCount`, for the "X of Y games finished" line on group cards. |
| P8 | The status filter reuses the existing public `GET /dropdown/game-statuses`. No backend change. |

---

## 2. Work items

### B1. Permission `competition.view`, dependencies, and dependency-aware assignment

Files:

- `src/shared/permissions.ts`
- `src/modules/people/user/admin/users.admin.service.ts`
- `src/modules/people/user/admin/users.admin.docs.ts`

**B1.1 Catalog entry.** Add a new group before the "گروه‌ها" group in `PERMISSION_CATALOG`:

```ts
{
  title: "مسابقات",
  permissions: [
    { code: "competition.view", label: "مشاهده صفحه‌ی مسابقات" },
  ],
},
```

`Permission`, `PERMISSION_CODES` and the Zod enums used by validation and Swagger are derived from the catalog, so nothing else needs to be edited for the new code.

**B1.2 Dependency rules.** Update `CROSS_RESOURCE_DEPENDENCIES`:

```ts
const CROSS_RESOURCE_DEPENDENCIES: Readonly<Record<string, readonly Permission[]>> = {
  "roster.view": ["teams.view"],
  "league-teams.view": ["leagues.view"],
  "league-roster.view": ["league-teams.view"],
  "competition.view": ["leagues.view"],
  "groups.view": ["competition.view", "leagues.view", "league-teams.view"],
  "games.view": ["competition.view", "leagues.view", "league-teams.view", "groups.view"],
};
```

Resulting effective sets (expansion is transitive and already implemented):

- `games.view` expands to `games.view`, `groups.view`, `competition.view`, `league-teams.view`, `leagues.view`.
- `groups.create` expands to `groups.create`, `groups.view`, `competition.view`, `league-teams.view`, `leagues.view`.
- `competition.view` expands to `competition.view`, `leagues.view`.

**B1.3 Single source for "direct prerequisites".** Add and export one function and make `expandPermissions` use it, so the dependency logic exists in one place:

```ts
export function getDirectRequirements(code: string): Permission[] {
  const dot = code.lastIndexOf(".");
  const resource = code.slice(0, dot);
  const implied = code.slice(dot + 1) !== "view" ? [`${resource}.view`] : [];
  const all = [...implied, ...(CROSS_RESOURCE_DEPENDENCIES[code] ?? [])];
  return [...new Set(all)].filter((c) => PERMISSION_SET.has(c)) as Permission[];
}
```

`expandPermissions` keeps its signature and behavior; inside the loop it pushes `getDirectRequirements(code)` instead of re-deriving the rules.

**B1.4 Catalog endpoint returns `requires`.** `users.admin.service.listPermissionCatalog()` maps the catalog:

```ts
function listPermissionCatalog() {
  return PERMISSION_CATALOG.map((group) => ({
    title: group.title,
    permissions: group.permissions.map((p) => ({
      code: p.code,
      label: p.label,
      requires: getDirectRequirements(p.code),
    })),
  }));
}
```

`GET /admin/users/permissions` stays SUPER_ADMIN only. The change is additive (existing consumers ignore the new field).

**B1.5 Assignment stores the expanded set, and returns codes.** In `users.admin.service.replaceUserPermissions`:

- `const uniquePermissions = expandPermissions(permissions);` (replaces the current `[...new Set(permissions)]`).
- Return `rows.map((r) => r.permission)`.

This also fixes an existing inconsistency: today the function returns the raw `adminPermission` rows, so `PUT /admin/users/:id/permissions` responds with `{ permissions: [ { id, userAdminId, permission } ] }` while the Swagger schema (and `GET /admin/users/:id/permissions`) say it is an array of codes. After the fix it returns an array of codes everywhere.

**B1.6 Swagger (`users.admin.docs.ts`).**

- `permissionGroupSchema`: each permission item gets `requires: z.array(permissionEnum)` with the description "Direct prerequisites. Granting this permission implicitly grants them (transitively)."
- `PUT /admin/users/{id}/permissions` description: state that the stored set is expanded with dependencies and the response contains the stored (expanded) codes.

**B1.7 Compatibility and rollout.**

- No data migration. `getPermissionsForUser` already expands stored rows when it issues a token, and `verifyPermission` expands token claims on every request. Existing ADMINs who hold `groups.view` therefore receive `competition.view` in their next access token (at most 15 minutes, or immediately after re-login).
- SUPER_ADMIN bypass is unchanged.
- No route needs `competition.view`: entering the page is enforced by the frontend only. Every data endpoint keeps its own permission (`leagues.view`, `groups.view`, `games.view`, and so on).

---

### B2. Dropdown endpoints for league groups and league teams

Files:

- `src/modules/shared/dropdowns/dropdowns.validation.ts`
- `src/modules/shared/dropdowns/dropdowns.service.ts`
- `src/modules/shared/dropdowns/dropdowns.controller.ts`
- `src/modules/shared/dropdowns/admin/dropdowns.admin.routes.ts`
- `src/modules/shared/dropdowns/dropdowns.docs.ts`
- `src/shared/schemas.validation.ts` (one small shared helper)
- `src/modules/leagues/lib/league.mapper.ts` and `src/modules/leagues/services/league-teams.service.ts` (one shared where-builder)

Both endpoints sit under the existing admin dropdown router (already behind `verifyJWT` and `verifyAdminLevel`, no permission gate, like `/dropdowns/admin/leagues`).

**B2.1 Endpoints.**

| Method and path | Query | Item shape |
|---|---|---|
| `GET /dropdowns/admin/league-groups` | `leagueId` (required), `search?`, `page`, `pageSize` | `{ value: groupId, label: groupName }` |
| `GET /dropdowns/admin/league-teams` | `leagueId` (required), `groupId?`, `search?`, `page`, `pageSize` | `{ value: leagueTeamId, label: teamName, organizationName: string \| null, groupId: number \| null }` |

Both return the standard dropdown envelope: `{ items, total, page, pageSize }` through `sendDropdown`. Note that `value` of the teams dropdown is the **league team id** (what the games filter `leagueTeamId` and the game form expect), not the team id.

An unknown `leagueId` returns 404 `league.notFound` on both endpoints (one `findUnique` on `league` selecting `status`).

**B2.2 Validation (`dropdowns.validation.ts`).**

- Add `requiredIdField(example)` next to the existing `optionalIdField`.
- Add a shared optional search schema in `src/shared/schemas.validation.ts` and use it in all three places (the existing `adminLeagueDropdownQuerySchema`, and the two new schemas), instead of copying the transform:

```ts
export const optionalSearchSchema = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    const normalized = normalizePersianText(value);
    return normalized.length ? normalized : undefined;
  });
```

- `adminLeagueGroupsDropdownQuerySchema = paginationQuerySchema.extend({ leagueId: requiredIdField(1), search: optionalSearchSchema.openapi({ example: "گروه" }) })`.
- `adminLeagueTeamsDropdownQuerySchema = adminLeagueGroupsDropdownQuerySchema.extend({ groupId: optionalIdField(1) })`.

**B2.3 Shared where-builder for visible league teams.** `league-teams.service.listLeagueTeams` already contains the rule "non-FINISHED leagues hide soft-deleted teams, FINISHED leagues keep them" inline. Extract it so the dropdown reuses it:

```ts
// league.mapper.ts, next to activeLeagueTeamWhere
export function visibleLeagueTeamWhere(
  leagueId: number,
  leagueStatus: LeagueStatus,
  search?: string,
): Prisma.LeagueTeamWhereInput {
  const finished = leagueStatus === "FINISHED";
  const base: Prisma.LeagueTeamWhereInput = finished
    ? { leagueId, status: "ACTIVE" }
    : activeLeagueTeamWhere(leagueId);
  if (!search) return base;
  return {
    ...base,
    team: {
      ...(finished ? {} : { status: { not: "DELETED" } }),
      name: { contains: search },
    },
  };
}
```

Replace the inline `where` building in `listLeagueTeams` with this helper (behavior must stay identical: same filters, same search clause).

**B2.4 Service (`dropdowns.service.ts`).**

- `getLeagueGroupsDropdown(query)`: assert the league exists; `where: { leagueId, ...(search ? { name: { contains: search } } : {}) }`; `orderBy: { id: "asc" }`; paginate; `items: { value: g.id, label: g.name }`.
- `getLeagueTeamsDropdown(query)`: load the league status (404 if missing); `where = visibleLeagueTeamWhere(leagueId, status, search)`, plus `groupTeam: { groupId }` when `groupId` is given; `orderBy: { id: "asc" }`; include `team { name, organization { name } }` and `groupTeam { groupId }`; `items: { value: lt.id, label: lt.team.name, organizationName: lt.team.organization?.name ?? null, groupId: lt.groupTeam?.groupId ?? null }`.
- Both use `prisma.$transaction([findMany, count])` like the other dropdowns.

**B2.5 Controller and routes.** `dropdownsController.getLeagueGroups` and `getLeagueTeams`; in `dropdowns.admin.routes.ts`:

```ts
router.get("/league-groups", validate(dropdownsValidation.adminLeagueGroupsDropdownQuerySchema, "query"), dropdownsController.getLeagueGroups);
router.get("/league-teams", validate(dropdownsValidation.adminLeagueTeamsDropdownQuerySchema, "query"), dropdownsController.getLeagueTeams);
```

Add both schemas to the default export of `dropdowns.validation.ts`.

**B2.6 Swagger (`dropdowns.docs.ts`).** Register both paths under tag "Dropdowns" with `security: [{ bearerAuth: [] }]`, responses 200 (paginated items), 400 (invalid query), 401, 403 (not an admin), 404 (league not found). Add `leagueGroupDropdownItemSchema` and `leagueTeamDropdownItemSchema` (extends the id/label item with `organizationName` and `groupId`).

---

### B3. Games list filters: `search` and `resultPending`

Files:

- `src/modules/competition/games/games.validation.ts`
- `src/modules/competition/games/admin/games.admin.validation.ts`
- `src/modules/competition/games/admin/games.admin.routes.ts`
- `src/modules/competition/games/admin/games.admin.docs.ts`
- `src/modules/competition/games/lib/games.queries.ts`

**B3.1 Query schemas.**

- `gamesListQuerySchema` (shared by the public and admin list) gains `search: optionalSearchSchema.openapi({ example: "عقاب", description: "Team name contains (home or away)" })`.
- `games.admin.validation.ts` adds an admin-only schema:

```ts
export const adminGamesListQuerySchema = gamesListQuerySchema.extend({
  resultPending: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true"))
    .openapi({
      example: "true",
      description:
        "true = only open games (SCHEDULED or LIVE) dated before today in Tehran",
    }),
});
```

  Do not use `z.coerce.boolean()`: it turns the string `"false"` into `true`.
- Add `adminGamesListQuerySchema` to the admin validation default export; the admin list route and the admin docs use it (the public list keeps `gamesListQuerySchema`).

**B3.2 Query builder (`games.queries.ts`).**

- `GamesListQuery` gains `search?: string` and `resultPending?: boolean`.
- Add one shared predicate and use it both in the summary count and in the list filter, so the "pending" definition exists once:

```ts
export function resultPendingWhere(now: Date = new Date()): Prisma.GameWhereInput {
  return {
    status: { in: ["SCHEDULED", "LIVE"] },
    scheduledDate: { lt: tehranDayStart(now) },
  };
}
// countResultPending(leagueId, now) becomes prisma.game.count({ where: { leagueId, ...resultPendingWhere(now) } })
```

- `buildGamesWhere(leagueId, query, now = new Date())` collects the combinable clauses in an `AND` array (the existing `leagueTeamId` clause already uses a top-level `OR`, so a second `OR` must not be added at the top level):

```ts
const and: Prisma.GameWhereInput[] = [];
if (query.leagueTeamId) and.push({ OR: [{ homeLeagueTeamId: query.leagueTeamId }, { awayLeagueTeamId: query.leagueTeamId }] });
if (query.search) and.push({ OR: [
  { homeTeam: { team: { name: { contains: query.search } } } },
  { awayTeam: { team: { name: { contains: query.search } } } },
] });
if (query.resultPending) and.push(resultPendingWhere(now));
return {
  leagueId,
  ...(query.status ? { status: query.status } : {}),
  ...(query.groupId ? { groupId: query.groupId } : {}),
  ...(dateRangeClause),          // unchanged scheduledDate gte/lte logic
  ...(and.length ? { AND: and } : {}),
};
```

- A combination such as `status=FINISHED` with `resultPending=true` correctly returns no rows, because both conditions apply.
- Public and admin services keep calling `buildGamesWhere(leagueId, query)`; no service change is required.

**B3.3 Swagger.** The new query parameters are documented automatically through the request schemas. Update the admin list description: mention `search` (home or away team name) and `resultPending` (admin only).

---

### B4. Game counts on admin group items

Files:

- `src/modules/competition/groups/lib/groups.queries.ts`
- `src/modules/competition/groups/lib/groups.mapper.ts`
- `src/modules/competition/groups/admin/groups.admin.service.ts`
- `src/modules/competition/groups/admin/groups.admin.docs.ts`

Meaning of the fields:

- `gamesCount`: games of the group that are not `CANCELED` (`SCHEDULED + LIVE + FINISHED`).
- `finishedGamesCount`: games of the group with status `FINISHED`.
- The existing `lock` (`HAS_GAMES`) keeps using the relation count of all games (including canceled), unchanged.

**B4.1 Query helper (`groups.queries.ts`).**

```ts
export async function loadGroupGameCounts(
  leagueId: number,
  groupIds?: number[],
): Promise<Map<number, { gamesCount: number; finishedGamesCount: number }>> {
  const rows = await prisma.game.groupBy({
    by: ["groupId", "status"],
    where: {
      leagueId,
      groupId: groupIds ? { in: groupIds } : { not: null },
      status: { not: "CANCELED" },
    },
    _count: { _all: true },
    orderBy: [{ groupId: "asc" }, { status: "asc" }],
  });
  // fold rows into the map: gamesCount += count; finishedGamesCount += count when status === "FINISHED"
}
```

One query, no game rows loaded.

**B4.2 Mapper.** `toGroupItem(group, leagueDefault, options)` accepts `options.gameCounts?: { gamesCount: number; finishedGamesCount: number }` and outputs `gamesCount` and `finishedGamesCount` (default `0`). The public groups mapper does not expose them.

**B4.3 Service.**

- `listGroups`: run `loadGroupGameCounts(leagueId)` in the existing `Promise.all` and pass each group's counts to `toGroupItem`.
- `updateGroup`: load counts for that single group with `loadGroupGameCounts(leagueId, [groupId])`.
- `createGroup`: counts are zero (no query).

**B4.4 Swagger.** Add both fields to `groupItemSchema` (integers, with the meaning above).

---

### B5. Documentation

- `docs/modules/shared.md`: list the two new admin dropdowns under `dropdowns/admin`, with their query parameters and item shapes.
- `docs/modules/competition.md`: games list filters (`search`, `resultPending`), group item `gamesCount` and `finishedGamesCount`, and a note that `competition.view` is the page-level permission (frontend-enforced) that `groups.view` and `games.view` depend on.
- `docs/modules/people.md`: the permission catalog items carry `requires`; replacing a user's permissions stores the dependency-expanded set and returns codes.
- `docs/status/roadmap.md`: add `competition.*` to the permissions line.

---

## 3. Execution order

1. B1 (permissions): this unblocks the frontend permission switch.
2. B2.3 (shared where-builder and its use in `listLeagueTeams`), then B2.1, B2.2, B2.4, B2.5, B2.6.
3. B3.
4. B4.
5. B5.

---

## 4. Verification checklist (manual)

Permissions:

- [ ] `GET /admin/users/permissions` (SUPER_ADMIN) lists a "مسابقات" group with `competition.view`, and every permission has `requires` (for example `groups.view` requires `competition.view`, `leagues.view`, `league-teams.view`; `groups.create` requires `groups.view`; `competition.view` requires `leagues.view`).
- [ ] `PUT /admin/users/:id/permissions` with `["games.view"]` stores `games.view`, `groups.view`, `competition.view`, `league-teams.view`, `leagues.view`, and the response is an array of codes (no row objects). `GET` for the same user returns the same codes.
- [ ] An ADMIN who already had only `groups.view` stored receives `competition.view` in the token after refreshing it (decode the JWT), without any DB change.
- [ ] A request to `GET /admin/leagues/:id/groups` with only `competition.view` still returns 403 (`Missing permission: groups.view`).

Dropdowns:

- [ ] `GET /dropdowns/admin/league-groups?leagueId=1` returns `{ value, label }` items in group id order; `search` filters by name; a non-existent league returns 404; a non-admin gets 403; a missing `leagueId` gets 400.
- [ ] `GET /dropdowns/admin/league-teams?leagueId=1` returns `value = leagueTeamId`; `groupId=` narrows to that group's teams; for a FINISHED league soft-deleted teams are still listed; for other statuses they are hidden.
- [ ] `GET /leagues/:id/teams` still behaves exactly as before after the where-builder extraction (same results with and without `search`, in a FINISHED league and in an ACTIVE league).

Games filters:

- [ ] `search` matches home or away team name; combined with `leagueTeamId` both conditions apply; an Arabic `ي`/`ك` in the search text still matches the Persian name.
- [ ] `resultPending=true` returns only SCHEDULED/LIVE games dated before today in Tehran; its count equals `summary.resultPending` for the unfiltered list; `resultPending=false` behaves like no filter; `status=FINISHED&resultPending=true` returns nothing.
- [ ] The public list accepts `search` and ignores `resultPending` (the unknown parameter does not break the request).

Group counts:

- [ ] A group with 4 games (1 canceled, 2 finished) reports `gamesCount = 3` and `finishedGamesCount = 2`, while `lock` is still `HAS_GAMES`; a group without games reports `0` and `0` with `lock = null`; `PUT .../groups/:id` returns the same counts.

---

## 5. Postponed

- Pairings endpoint and any pair-quota helper data (the frontend derives a hint from the existing games list instead).
- Tests for the pure rules.