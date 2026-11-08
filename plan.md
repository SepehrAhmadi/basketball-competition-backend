# Stage 3 Follow-up Fixes (v3, small)

Scope: exactly the five items from the second code review. Nothing else is in scope: no new features, no behavior changes outside the items below, no tests, no refactors of other modules. Do not touch `jalaliDateSchema` / `idField` duplication, and do not touch the `groups` validation layout.

Items are ordered so that each step leaves the project compiling. Apply them in this order: F5, F3, F2, F1, F4, then the docs step.

---

## F5. Rename `publicGamesQuerySchema` to `gamesListQuerySchema`

Problem: the admin list uses a schema named "public". The schema is shared by the public and admin lists, so the name is misleading.

Change (pure rename, no behavior change):

- `src/modules/competition/games/games.validation.ts`: rename the export `publicGamesQuerySchema` to `gamesListQuerySchema`, including the entry in the default export object.
- Update every usage:
  - `games/games.routes.ts` (`gamesValidation.gamesListQuerySchema`)
  - `games/games.docs.ts` (import and `request.query`)
  - `games/admin/games.admin.validation.ts` (re-export list and default export)
  - `games/admin/games.admin.routes.ts` (`gamesAdminValidation.gamesListQuerySchema`)
  - `games/admin/games.admin.docs.ts` (import and `request.query`)
- Do not keep an alias: all consumers are inside the repo, so an alias would only be dead code.

Check: `grep -rn "publicGamesQuerySchema" src docs` returns nothing. The query schema has no registered OpenAPI name, so the generated Swagger does not change.

---

## F3. `cancelReason` only together with `status: CANCELED`

Problem: `PATCH .../status` accepts `cancelReason` together with `status: "LIVE"` and silently ignores it.

Changes:

- `src/language/message.ts`, `error.game`: add
  - `cancelReasonNotAllowed`: `"دلیل لغو فقط همراه وضعیت کنسل‌شده قابل ارسال است"`
- `games/admin/games.admin.validation.ts`, `updateGameStatusSchema`: after `.strict()` add

```ts
.refine(
  (data) => data.status === "CANCELED" || data.cancelReason == null,
  {
    message: messages.error.game.cancelReasonNotAllowed,
    path: ["cancelReason"],
  },
)
```

- `cancelReason: null` stays valid for both statuses (it means "no reason"). Only a non-null value together with `LIVE` is rejected, with a 400 from the `validate` middleware (`cancelReason: <message>`).
- No service change: `updateStatus` already writes `cancelReason` only for `CANCELED`.
- `games/admin/games.admin.docs.ts`: mention the rule in the `PATCH .../status` description and in its 400 description (see F4).

---

## F2. `UNSCHEDULED` warning only for open games

Problem: canceled games (and finished games) that never had a date get the "date not set" warning.

Decision: the warning applies only to `SCHEDULED` and `LIVE` games. A `FINISHED` game without a date no longer warns.

Changes:

- `games/lib/games.rules.ts`: add a pure helper next to `isResultPending`:

```ts
export function isUnscheduled(
  status: GameStatusValue,
  scheduledDate: Date | null,
): boolean {
  return (status === "SCHEDULED" || status === "LIVE") && scheduledDate === null;
}
```

- `games/lib/games.mapper.ts`, `toAdminGameItem`: replace `unscheduled: row.scheduledDate === null` with `unscheduled: isUnscheduled(row.status, row.scheduledDate)` (import the helper).
- `games/admin/games.admin.docs.ts`: in the `issues` description, state that `UNSCHEDULED` is produced only for `SCHEDULED` and `LIVE` games.
- `docs/modules/competition.md`: same wording in the sentence that lists the admin item `issues`.
- Do not change `OUTSIDE_LEAGUE_PERIOD` or `RESULT_PENDING`.

---

## F1. `assignTeam` is idempotent even when the group has games

Problem: `groups.admin.service.assignTeam` calls `assertGroupHasNoGames(groupId)` before it reads the existing placement. Re-assigning a team that is already in a group that has games returns 409, although the docs say re-assignment is idempotent and nothing would change.

File: `src/modules/competition/groups/admin/groups.admin.service.ts`, function `assignTeam`.

Change: read the existing placement first and return early on a no-op. Keep `loadAssignmentContext` first (league 404, `FINISHED` 409, group 404, league team 404 keep their order).

```ts
async function assignTeam(leagueId: number, groupId: number, leagueTeamId: number) {
  const { league } = await loadAssignmentContext(leagueId, groupId, leagueTeamId);
  const existing = await prisma.groupTeam.findUnique({ where: { leagueTeamId } });

  // Re-assigning to the same group is a no-op: idempotent, not blocked by the group lock.
  if (existing && existing.groupId === groupId) {
    return buildPlacementResult(leagueId, [groupId], league.defaultQualifiersPerGroup);
  }

  // A real placement change: both the target group and the source group (when moving) must be unlocked.
  await assertGroupHasNoGames(groupId);
  if (existing) await assertGroupHasNoGames(existing.groupId);

  try {
    await prisma.groupTeam.upsert({
      where: { leagueTeamId },
      create: { groupId, leagueTeamId },
      update: { groupId },
    });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "P2002")
      throw new AppError(409, messages.error.group.teamAssignConflict);
    throw err;
  }

  return buildPlacementResult(
    leagueId,
    existing ? [groupId, existing.groupId] : [groupId],
    league.defaultQualifiersPerGroup,
  );
}
```

Notes:

- Behavior for real changes (first assignment, move) is unchanged, including the lock on both groups and the `P2002` mapping.
- The `FINISHED` league lock still applies to a no-op re-assign (it is checked inside `loadAssignmentContext`), which is acceptable.
- `groups/admin/groups.admin.docs.ts`, assign endpoint: keep the "Idempotent" description; in the 409 description say that the lock applies when the placement actually changes (target or source group has games), not to an idempotent re-assign.
- `docs/modules/competition.md`, group lock paragraph: add one sentence: "Re-assigning a team to the group it already belongs to is idempotent and is not blocked by the group lock."

---

## F4. Admin Swagger: realistic error examples and no duplicated game schema

Problem 1: `gameErrors()` in `games.admin.docs.ts` uses fixed example messages (every 400 shows `sameTeam`, every 409 shows `statusLocked`, every 404 shows `game.notFound`).

Problem 2: `adminGameTeamSchema` is an exact copy of `publicGameTeamSchema`, and `adminGameSchema` repeats all public game fields.

Changes in `games/games.docs.ts` (public):

- Export `publicGameTeamSchema` and `publicGameSchema` (they stay registered as `PublicGameTeam` and `PublicGame`).

Changes in `games/admin/games.admin.docs.ts`:

- Delete `adminGameTeamSchema`.
- Build the admin item from the public one, the same way `league-teams.admin.docs.ts` reuses `leagueTeamItemSchema`:

```ts
import { publicGameSchema } from "../games.docs.ts";

const adminGameSchema = publicGameSchema
  .extend({
    resultNote: z.string().nullable().openapi({ example: null }),
    cancelReason: z.string().nullable().openapi({ example: null }),
    scheduleLock: lockField("..."),   // keep the existing five lock fields and their descriptions
    startLock: lockField("..."),
    cancelLock: lockField("..."),
    resultLock: lockField("..."),
    deleteLock: lockField("..."),
    issues: z.array(advisorySchema).openapi({ description: "..." }),
  })
  .openapi("AdminGame");
```

  Keep the existing lock descriptions and the `issues` description (with the F2 wording). The team objects in admin responses now reference the shared `PublicGameTeam` component, which is correct because the shape is identical.
- Change `gameErrors` so that every documented error carries its own description and example message:

```ts
type ErrorSpec = { description: string; message: string };

function gameErrors(options: {
  permission: string;
  notFound: ErrorSpec;
  badRequest?: ErrorSpec;
  conflict?: ErrorSpec;
}) { /* 400 (optional), 401, 403, 404, 409 (optional), each with its own example message */ }
```

- Per endpoint (description keeps the current wording; the example message changes):

| Endpoint | 400 example | 404 example | 409 example |
|---|---|---|---|
| `GET /` | none | `league.notFound` | none |
| `GET /:gameId` | none | `game.notFound` | none |
| `POST /` | `game.sameTeam` | `leagueTeam.notFound` | `game.pairLimitReached` |
| `PUT /:gameId` | `game.dateTimeTogether` | `game.notFound` | `game.scheduleLocked` |
| `PATCH /:gameId/status` | `game.cancelReasonNotAllowed` | `game.notFound` | `game.statusLocked` |
| `PUT /:gameId/result` | `game.tieNotAllowed` | `game.notFound` | `game.statusLocked` |
| `DELETE /:gameId/result` | none | `game.notFound` | `game.noResultToClear` |
| `DELETE /:gameId` | none | `game.notFound` | `game.deleteNotAllowed` |

  All messages come from `messages.error.*` (no inline strings). The set of documented status codes per endpoint does not change.
- The 403 example stays `"Forbidden"`; the 401 example stays `"Unauthorized"`.

Not in scope: the `groups` docs (`groupTeamSchema` vs `publicGroupTeamSchema` have the same duplication; leave them).

---

## Docs step

Only these documentation edits (all small, all mentioned above):

- `docs/modules/competition.md`: `UNSCHEDULED` wording (F2) and the idempotent re-assign sentence (F1).
- No other doc changes.

---

## Verification checklist (manual)

- [ ] `grep -rn "publicGamesQuerySchema" src docs` returns no result; the project starts and `/docs` (Swagger) loads.
- [ ] `PATCH .../status` with `{ "status": "LIVE", "cancelReason": "x" }` returns 400 with `cancelReason: ...`; with `{ "status": "LIVE", "cancelReason": null }` or `{ "status": "CANCELED", "cancelReason": "x" }` it succeeds.
- [ ] A canceled game that has no date has no `UNSCHEDULED` issue; a `SCHEDULED` game without a date still has it; a `FINISHED` game without a date has none.
- [ ] `PUT .../groups/:groupId/teams/:leagueTeamId` for a team already in a group that has games returns 200 with the placement summary; moving that team to another group (or moving another team into that group) still returns 409 `group.hasGames`; a first assignment into a group that has games still returns 409.
- [ ] In Swagger, each admin games endpoint shows its own example error messages, and `AdminGame` no longer contains a separate `AdminGameTeam` component.