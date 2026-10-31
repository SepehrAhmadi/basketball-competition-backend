# Backend Plan: League Dropdown Endpoint

## 1. Goal

Add one read-only endpoint that returns leagues as dropdown items, so the admin panel and the app can let a user pick a league (for example, the league selector on the group-management page).

- **Route:** `GET /api/v1/dropdowns/leagues`
- **Access:** any authenticated user (`verifyJWT`), like the other dropdowns.
- **Scope:** read-only. No writes, no new permission, no new table, no migration.

---

## 2. Decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Who can call it | Every logged-in user. The route sits under `dropdownsRoutes`, which already applies `verifyJWT`. |
| 2 | Visibility of `INACTIVE` leagues | **Hidden from non-admins, visible to admins.** This matches the public league rules (`leaguePolicy.view`, `loadLeagueContext`). Without this, an `INACTIVE` league (a draft that has not been published) would leak to every user through the dropdown. |
| 3 | Visibility of other statuses | `REGISTRATION`, `ACTIVE`, `FINISHED` are visible to everyone. |
| 4 | Admin check | Read `req.adminLevel` from the token (set by `verifyJWT`). No database call is needed. |
| 5 | Ordering | `id desc` (newest first), same as the league lists. |
| 6 | Pagination | Standard `page` / `pageSize` (default 20, max 100), same as all dropdowns. |
| 7 | Label | `"<league name> — <season name> — <age category name>"` (em dash with spaces). |
| 8 | Search | Case-sensitive `contains` on the league name. The input is trimmed and Arabic `ي` / `ك` are mapped to Persian `ی` / `ک`, the same normalization used when league names are saved. |
| 9 | Status filter | Optional `status`. It is intersected with the statuses the caller is allowed to see, so a non-admin asking for `status=INACTIVE` gets an empty list (not a 403). |
| 10 | Cache | None. Same as the other dropdowns. |

---

## 3. API Contract

### 3.1 Request

`GET /dropdowns/leagues?page=1&pageSize=20&search=...&seasonId=...&ageCategoryId=...&status=...`

| Query param | Type | Required | Notes |
|---|---|---|---|
| `page` | int ≥ 1 | no (default 1) | from `paginationQuerySchema` |
| `pageSize` | int 1–100 | no (default 20) | from `paginationQuerySchema` |
| `search` | string | no | name contains, normalized (see decision 8) |
| `seasonId` | positive int | no | filters through `ageCategoryCutoff.seasonId` |
| `ageCategoryId` | positive int | no | filters through `ageCategoryCutoff.ageCategoryId` |
| `status` | enum | no | one of `INACTIVE`, `REGISTRATION`, `ACTIVE`, `FINISHED` |

### 3.2 Response (`200`)

Uses the standard envelope `{ statusCode, message, data }` with `data` shaped as `paginatedResponseSchema(leagueDropdownItemSchema)`:

```json
{
  "statusCode": 200,
  "message": "فهرست با موفقیت دریافت شد",
  "data": {
    "items": [
      {
        "value": 3,
        "label": "لیگ برتر نوجوانان — فصل ۱۴۰۵ — نوجوانان",
        "status": "REGISTRATION",
        "seasonId": 2,
        "ageCategoryId": 1
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

Item fields:

| Field | Type | Meaning |
|---|---|---|
| `value` | number | league id |
| `label` | string | display text (decision 7) |
| `status` | enum | league status, so the UI can color or group items |
| `seasonId` | number | lets the UI filter or group without a second request |
| `ageCategoryId` | number | same reason as `seasonId` |

### 3.3 Errors

| Code | When |
|---|---|
| `400` | invalid query (for example `pageSize=500`, `status=DRAFT`), via `validate` |
| `401` | missing or invalid access token |

No `403` and no `404` on this endpoint.

---

## 4. Files to Change

All paths are under `src/modules/shared/dropdowns/`.

| File | Change |
|---|---|
| `dropdowns.validation.ts` | Add `leagueDropdownQuerySchema` = `dropdownSearchQuerySchema.extend({ seasonId, ageCategoryId, status })`. Export it in the default object. |
| `lib/league-dropdown.rules.ts` (new) | Pure helpers, no Prisma and no Express: `allowedLeagueStatuses(isAdmin, requested?)` and `buildLeagueLabel({ name, seasonName, ageCategoryName })`. |
| `lib/league-dropdown.rules.test.ts` (new) | Unit tests (see section 6). |
| `dropdowns.service.ts` | Add `getLeaguesDropdown(query, { isAdmin })`. Builds the `where`, runs `findMany` and `count` in one `$transaction`, maps rows to items. |
| `dropdowns.controller.ts` | Add `getLeagues`. Reads `req.validatedQuery` and `req.adminLevel`, calls the service, responds with `sendDropdown`. |
| `dropdowns.routes.ts` | Add `router.get("/leagues", validate(leagueDropdownQuerySchema, "query"), dropdownsController.getLeagues)`. |
| `dropdowns.docs.ts` | Add a `registerPath` for `GET /dropdowns/leagues` with `bearerAuth`, the query schema, and the `200` / `400` / `401` responses. Add `leagueDropdownItemSchema` with `.openapi("LeagueDropdownItem")`. |

No change to `schema.prisma`, no migration, no new permission, no new message key (use `messages.success.dropdown.fetched`).

---

## 5. Implementation Details

### 5.1 Pure helpers (`lib/league-dropdown.rules.ts`)

```ts
import type { LeagueStatus } from "../../../../prisma/generated/prisma/enums.ts";

const ALL_STATUSES: LeagueStatus[] = ["INACTIVE", "REGISTRATION", "ACTIVE", "FINISHED"];
const PUBLIC_STATUSES: LeagueStatus[] = ["REGISTRATION", "ACTIVE", "FINISHED"];

// Statuses the caller may see, narrowed by the optional requested status.
// Returns [] when the request asks for a status the caller may not see.
export function allowedLeagueStatuses(isAdmin: boolean, requested?: LeagueStatus): LeagueStatus[] {
  const base = isAdmin ? ALL_STATUSES : PUBLIC_STATUSES;
  if (!requested) return base;
  return base.includes(requested) ? [requested] : [];
}

export function buildLeagueLabel(input: {
  name: string;
  seasonName: string;
  ageCategoryName: string;
}): string {
  return `${input.name} — ${input.seasonName} — ${input.ageCategoryName}`;
}
```

Adjust the import path to the actual depth of the `lib` folder.

### 5.2 Service (`dropdowns.service.ts`)

```ts
async function getLeaguesDropdown(
  query: LeagueDropdownQuery,
  requester: { isAdmin: boolean },
) {
  const statuses = allowedLeagueStatuses(requester.isAdmin, query.status);
  const search = normalizeSearch(query.search); // trim + ي/ك mapping, undefined if empty

  const where: Prisma.LeagueWhereInput = {
    status: { in: statuses },
    ...(search ? { name: { contains: search } } : {}),
    ...(query.seasonId || query.ageCategoryId
      ? {
          ageCategoryCutoff: {
            ...(query.seasonId ? { seasonId: query.seasonId } : {}),
            ...(query.ageCategoryId ? { ageCategoryId: query.ageCategoryId } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.league.findMany({
      where,
      orderBy: { id: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        name: true,
        status: true,
        ageCategoryCutoff: {
          select: {
            seasonId: true,
            ageCategoryId: true,
            season: { select: { name: true } },
            ageCategory: { select: { name: true } },
          },
        },
      },
    }),
    prisma.league.count({ where }),
  ]);

  return {
    items: items.map((l) => ({
      value: l.id,
      label: buildLeagueLabel({
        name: l.name,
        seasonName: l.ageCategoryCutoff.season.name,
        ageCategoryName: l.ageCategoryCutoff.ageCategory.name,
      }),
      status: l.status,
      seasonId: l.ageCategoryCutoff.seasonId,
      ageCategoryId: l.ageCategoryCutoff.ageCategoryId,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}
```

Notes:

- `status: { in: [] }` returns no rows in Prisma, which gives the empty result for decision 9 without a special branch.
- Only the fields needed for the label are selected. Do not reuse `leagueInclude`; it also counts teams, which a dropdown does not need.
- `normalizeSearch` should be the same helper that the league-name normalization uses. If it lives in `age-categories` or `leagues` validation, move it to `src/utils/` so both modules share one function. Do not copy it.

### 5.3 Controller (`dropdowns.controller.ts`)

```ts
async function getLeagues(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.validatedQuery as LeagueDropdownQuery;
    const result = await dropdownsService.getLeaguesDropdown(query, {
      isAdmin: req.adminLevel != null,
    });
    return sendDropdown(res, result);
  } catch (err) {
    next(err);
  }
}
```

Use `req.validatedQuery` directly, because the route always runs `validate`.

### 5.4 Route (`dropdowns.routes.ts`)

```ts
router.get(
  "/leagues",
  validate(dropdownsValidation.leagueDropdownQuerySchema, "query"),
  dropdownsController.getLeagues,
);
```

The router-level `verifyJWT` already covers it. Place it with the other dropdown routes.

### 5.5 Swagger (`dropdowns.docs.ts`)

- `security: [{ bearerAuth: [] }]`, same as the other dropdowns.
- Description: "Searchable list of leagues for dropdowns. Non-admin callers never receive `INACTIVE` leagues. Admins receive all statuses."
- Responses: `200` (paginated `LeagueDropdownItem`), `400`, `401`.

---

## 6. Tests

Add `lib/league-dropdown.rules.test.ts` using `node:test`, like the existing rule tests:

- `allowedLeagueStatuses(false)` → `REGISTRATION`, `ACTIVE`, `FINISHED` (no `INACTIVE`).
- `allowedLeagueStatuses(true)` → all four statuses.
- `allowedLeagueStatuses(false, "INACTIVE")` → `[]`.
- `allowedLeagueStatuses(false, "ACTIVE")` → `["ACTIVE"]`.
- `allowedLeagueStatuses(true, "INACTIVE")` → `["INACTIVE"]`.
- `buildLeagueLabel` joins with ` — ` in the right order.

Manual checks (Swagger or Postman):

1. Non-admin token: the response has no `INACTIVE` items, even with no status filter.
2. Non-admin token with `status=INACTIVE`: `items: []`, `total: 0`.
3. Admin token: `INACTIVE` leagues appear.
4. `search=برتر` matches a name that contains `برتر`, and a name written with Arabic `ي` still matches after normalization.
5. `seasonId` and `ageCategoryId` filter correctly, and together they narrow the result.
6. `pageSize=101` → `400`. No token → `401`.
7. Order is `id desc`.

---

## 7. Documentation Updates

| File | Change |
|---|---|
| `docs/modules/shared.md` | Add `GET /dropdowns/leagues` under `dropdowns`: any authenticated user, `INACTIVE` hidden from non-admins, label format. |
| `docs/status/current-state.md` | Note that the league dropdown is done (backend). |
| `docs/status/roadmap.md` | No change needed unless you want to track the frontend selector separately. |

---

## 8. Frontend Notes (no backend change)

- Use `search` with a debounce (for example 300 ms) for the autocomplete.
- Store the chosen league id in the URL (`?leagueId=`), as agreed for the group page.
- Show `status` as a small badge next to the label if you want to distinguish drafts (admin only sees them) and finished leagues.
- The same endpoint can feed any other league selector in the admin panel and the app.

---

## 9. Acceptance Checklist

- [ ] `GET /dropdowns/leagues` works for any logged-in user and returns `401` without a token.
- [ ] Non-admins never receive `INACTIVE` leagues, with or without a filter.
- [ ] Admins receive all statuses.
- [ ] `label` follows `name — season — age category`.
- [ ] `search` is trimmed and Arabic/Persian letters are normalized.
- [ ] `seasonId`, `ageCategoryId`, and `status` filters work, alone and combined.
- [ ] Results are ordered by `id desc` and paginated.
- [ ] Swagger documents the endpoint and its responses.
- [ ] Unit tests for the pure helpers pass.
- [ ] Shared module docs and current-state are updated.