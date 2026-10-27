# League Competition Structure — Decisions (Stage 1)

This is the persistent decision record for the competition module. It mirrors
`plan.md` Stage 1 and is the reference for later stages.

## Scope

Stage 1 covers the competition format settings only: enums, `League` columns,
admin `GET`/`PUT` endpoints, pure rules, validation, Swagger and reference-data
endpoints. Groups (Stage 2), games (Stage 3), standings (Stage 4), brackets
(Stage 5) and player stats (Stage 6) are out of scope.

## Structure and dependencies

- `modules/competition/` sits next to `leagues/` with one sub-module per concept.
- Dependency direction is one-way: `competition → leagues`. `leagues` never
  imports from `competition`.
- `format/admin/` follows the nested admin pattern already used by `leagues` and
  `age-categories`; file names do not carry a `competition` prefix.
- `format/lib/format.rules.ts` is pure (no Prisma, no `AppError`).
- No `format.policy.ts`; the lock is a status check plus a future game-existence
  check computed in the service. Admin responses expose the reason as a
  `lock` advisory (`lib/format.advisories.ts` builds it from the internal
  `FormatLockReason` code); they do not carry a `can` flag. App-facing
  endpoints keep the project's `can`-flag convention.

## Data model

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

`League` adds:

| Field | Type | Meaning |
|---|---|---|
| `format` | `LeagueFormat?` | `null` = not configured yet |
| `winPoints` | `Int` default 2 | always stored |
| `lossPoints` | `Int` default 1 | always stored |
| `groupRoundType` | `GroupRoundType?` | only for group formats |
| `defaultQualifiersPerGroup` | `Int?` | only for group formats; for `SINGLE_GROUP_KNOCKOUT` it is the total qualifier count |

Format is a setting on `League`, not an entity. Number of groups and per-group
qualifier overrides belong to Stage 2 on `Group`. Standings, seeds and brackets
are never stored.

## Endpoints and permissions

- `GET /admin/leagues/:leagueId/format` — `leagues.view`.
- `PUT /admin/leagues/:leagueId/format` — `leagues.update`.
- Both are admin-panel only (JWT + admin level). No public format endpoint.
- `PUT` replaces the whole object; unknown keys are rejected (strict schema).

## Format rules and validation

- `format` is required.
- `winPoints` / `lossPoints` are required integers in `[0, 10]`;
  `winPoints` must exceed `lossPoints`. `PUT` always receives both values.
- The database defaults (2 / 1) only fill new leagues and leagues whose format
  has not been configured yet; they are never applied to a `PUT` body.
- Group formats require `groupRoundType` and `defaultQualifiersPerGroup`
  (positive integer, max 64).
- `KNOCKOUT_ONLY` tolerates the two group fields in the body but they are
  ignored and stored as `null`.
- Compatibility with the actual number of teams is a Stage 2 concern.

## Locking

- `FINISHED` always blocks format edits (409, `league.finishedLocked`).
- Once games exist, `HAS_GAMES` locks edits (Stage 3; direct Prisma count, no
  import from `games`).
- Switching to `KNOCKOUT_ONLY` while groups exist is blocked (409 `hasGroups`); switching to `SINGLE_GROUP_KNOCKOUT` with more than one group is blocked (409 `tooManyGroups`). Count comes from `Group` rows — no `groupCount` column on `leagues`.
- Admin `GET` reports the lock through the `lock` advisory (`{"code",
  "severity", "message", "params"}`; `FINISHED` today, `HAS_GAMES` once Stage 3
  lands, `null` when editable), so the UI shows the reason instead of only an
  error. The admin format response has no `can` flag.
- App-facing league responses keep using `can` flags (`leagues.policy.ts`) and
  are unchanged by the format contract.

## Later-stage hooks

| Stage | Addition |
|---|---|
| 2 – groups | ✅ Done: format-change guards, per-group qualifier overrides, group warnings |
| 3 – games | Activate `HAS_GAMES`; `TODO(Game)` in status/unregister paths |
| 4 – standings | Read `winPoints` / `lossPoints` from the league row |
| 5 – brackets | Read `format` to know whether a group stage precedes the bracket |
| 6 – player stats | Add per-player-per-game stats referencing league records |

## Open decisions

### Group count (decided before Stage 2)

The format action does not store the number of groups. **Decision (implemented in Stage 2): derive the count from `Group` rows for the league.** No `groupCount` column is added to `leagues`. The format endpoint only supplies `defaultQualifiersPerGroup`; per-group overrides and the actual group count belong to `Group` records.

