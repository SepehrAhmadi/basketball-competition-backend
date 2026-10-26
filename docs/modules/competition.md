# Competition

## Purpose

Owns the competition structure and scoring rules of a league. Stage 1 stores the
format as settings on the existing `League` row and exposes admin endpoints for
reading and replacing it. Later stages add groups, games, standings, brackets and
player stats under the same parent folder.

## Entities

- No new table in Stage 1. `League.format`, `winPoints`, `lossPoints`,
  `groupRoundType` and `defaultQualifiersPerGroup` hold the settings.
- Planned: `Group` (Stage 2), `Game` (Stage 3), standings/brackets computed (not
  stored) and player game stats (Stage 6).

## Sub-modules

- `format/` — done.
  - `format/admin/` — `GET` / `PUT` `/admin/leagues/:leagueId/format` (routes,
    controller, service, validation, docs).
  - `format/lib/format.rules.ts` — pure constants, value lists, format
    normalization and the lock-reason type; no Prisma or `AppError`.
- Planned (not implemented): `groups/`, `games/`, `standings/`, `brackets/`,
  `player-stats/`.

## Responsibilities

- `PUT` replaces the whole format object. `groupRoundType` and
  `defaultQualifiersPerGroup` are required for group formats and ignored
  (stored as `null`) for `KNOCKOUT_ONLY`. `winPoints` and `lossPoints` are
  required (`winPoints` must exceed `lossPoints`) and are always stored. The
  DB defaults (2 / 1) only apply to new or not-yet-configured leagues.
- `format = null` means "not configured yet"; a league is created without a
  format because its team count is unknown at creation time.
- Format editing is allowed in `INACTIVE`, `REGISTRATION` and `ACTIVE` while no
  game exists. `FINISHED` is always locked (reopening stays a `SUPER_ADMIN`
  status action).
- Admin responses expose `lock` (an `Advisory` with `code`, `severity`,
  `message`, `params`; `null` when editable) so the UI can show why editing is
  blocked; the admin format response has no `can` flag. Codes: `FINISHED`
  (`BLOCKER`), and `HAS_GAMES` (`BLOCKER`, reserved for Stage 3 and not emitted
  yet). Render `lock.message`; use `lock.code` for icon/color.
  App-facing league responses keep their `can` flags.
- Permissions reuse `leagues.view` for `GET` and `leagues.update` for `PUT`; no
  new permission in Stage 1.

## Relationships with other modules

- → `leagues`: one-way dependency. `competition` imports `leagues` helpers
  (e.g. `leagueIdParamSchema`) and reads/writes the `League` row. `leagues`
  never imports `competition`; it only exposes the new columns in its own
  response through its own mapper.
- Planned chain (one-way): `format ← groups ← games ← standings ← brackets`.
  Game-existence checks use direct Prisma queries so `format` never imports
  from `games`.

See `competition-structure.md` for the Stage 1 decision record.
