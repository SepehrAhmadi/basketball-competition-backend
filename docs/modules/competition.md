# Competition

## Purpose

Owns the competition structure and scoring rules of a league. Stage 1 stores the
format as settings on the existing `League` row and exposes admin endpoints for
reading and replacing it. Later stages add groups, games, standings, brackets and
player stats under the same parent folder.

## Entities

- `League.format`, `winPoints`, `lossPoints`, `groupRoundType` and
  `defaultQualifiersPerGroup` hold the format settings.
- `Group` (`league_groups`: `leagueId`, unique `leagueId`+`name`,
  `qualifiersOverride`) and `GroupTeam` (`league_group_teams`: `groupId`,
  unique `leagueTeamId`). One group per league team; hard-deleted on
  unregister; group delete unassigns teams first.
- Planned: `Game` (Stage 3), standings/brackets computed (not stored) and
  player game stats (Stage 6).

## Sub-modules

- `format/` — done.
  - `format/admin/` — `GET` / `PUT` `/admin/leagues/:leagueId/format` (routes,
    controller, service, validation, docs).
  - `format/lib/format.rules.ts` — pure constants, value lists, format
    normalization, the lock-reason type, and `evaluateFormatChange`
    (`HAS_GROUPS` / `TOO_MANY_GROUPS`); no Prisma or `AppError`.
- `groups/` — done.
  - `groups/admin/` — admin grouping endpoints (list, unassigned list,
    create, update, delete, assign/move, remove) with `groups.*` permissions.
  - `groups/groups.*` — public read `GET /leagues/:leagueId/groups`.
  - `groups/lib/` — pure `groups.rules.ts` (create/qualifier/issue rules,
    lock reason), `groups.advisories.ts` (issue/lock builders),
    `groups.access.ts` (league/group/team loaders), `groups.mapper.ts`.
- Planned (not implemented): `games/`, `standings/`, `brackets/`,
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
- Groups use `groups.view` (implies `leagues.view` + `league-teams.view`),
  `groups.create`, `groups.update` (assign/move/remove), `groups.delete`.
  Creation needs a group format (`GROUPS_KNOCKOUT` / `SINGLE_GROUP_KNOCKOUT`;
  409 otherwise, single-group limit for `SINGLE_GROUP_KNOCKOUT`). Editing is
  allowed in `INACTIVE`/`REGISTRATION`/`ACTIVE`; `FINISHED` returns 409 with
  a `BLOCKER` lock. Issues (`GROUP_TOO_SMALL`, `QUALIFIERS_EXCEED_TEAMS`,
  `TEAM_UNASSIGNED`) are always `WARNING` and never block saving.
  Switching format to `KNOCKOUT_ONLY` with groups, or to
  `SINGLE_GROUP_KNOCKOUT` with more than one group, returns 409.

## Relationships with other modules

- → `leagues`: one-way dependency. `competition` imports `leagues` helpers
  (e.g. `leagueIdParamSchema`) and reads/writes the `League` row. `leagues`
  never imports `competition`; it only exposes the new columns in its own
  response through its own mapper.
- Chain (one-way): `format ← groups ← games ← standings ← brackets`.
  Game/group-existence checks use direct Prisma queries so `format` never
  imports from `games` or `groups`; `groups` imports format rules and league
  mappers only.

See `competition-structure.md` for the Stage 1 decision record.
