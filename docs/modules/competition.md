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
- `Game` (`games`: `leagueId`, nullable `groupId`, `homeLeagueTeamId`,
  `awayLeagueTeamId`, `status` `SCHEDULED`/`LIVE`/`FINISHED`/`CANCELED`,
  separate `scheduledDate` (`@db.Date`) and `scheduledTime` (`HH:mm`), scores,
  `resultType` `NORMAL`/`FORFEIT`, `forfeitLeagueTeamId`, `resultNote`,
  `cancelReason`, unique `rescheduledFromGameId`). FKs to `group` and
  `forfeitTeam` are `Restrict`: a game's group is permanent history.
- Planned: standings/brackets computed (not stored) and player game stats
  (Stage 6).

## Sub-modules

- `format/` — done.
  - `format/admin/` — `GET` / `PUT` `/admin/leagues/:leagueId/format` (routes,
    controller, service, validation, docs).
  - `format/lib/format.rules.ts` — pure constants, value lists, format
    normalization, `isGroupedFormat`, `getFormatLockReason`, value lists derived
    from the Prisma enums, and `evaluateFormatChange`
    (`HAS_GROUPS` / `TOO_MANY_GROUPS`); no Prisma or `AppError`.
- `groups/` — done.
  - `groups/admin/` — admin grouping endpoints (list, unassigned list,
    create, update, delete, assign/move, remove) with `groups.*` permissions.
  - `groups/groups.*` — public read `GET /leagues/:leagueId/groups`.
  - `groups/lib/` — pure `groups.rules.ts` (create/qualifier/issue rules,
    lock reason), `groups.advisories.ts` (issue/lock builders),
    `groups.access.ts` (league/group/team loaders; `loadAssignmentContext`
    runs them in parallel but reports errors in a fixed order),
    `groups.queries.ts` (`groupWithTeamsInclude`, derived `GroupWithTeams`,
    `countUnassigned`, counter-only `loadGroupSummaries`), `groups.mapper.ts`
    (`toGroupItem`, `toGroupTeamItem`).
- `games/` — done (Stage 3, group-stage games only).
  - `games/games.*` + `games.validation.ts` — public read
    `GET /leagues/:leagueId/games[/:gameId]` (no `resultNote`/`cancelReason`;
    `teamStatus` only in `FINISHED` leagues).
  - `games/admin/` — `GET`, `GET /:gameId`, `POST`, `PUT /:gameId` (schedule),
    `PATCH /:gameId/status`, `PUT` and `DELETE /:gameId/result`,
    `DELETE /:gameId` under `/admin/leagues/:leagueId/games`. Permissions:
    `games.view`, `games.create`, `games.update` (schedule, status),
    `games.result` (enter, edit, clear), `games.delete`.
  - `games/lib/` — `games.rules.ts` (pure: `evaluateGameActions`,
    `buildResultData`, `notSwappedGameIds`, pair quota, warnings),
    `games.advisories.ts` (lock/issue builders), `games.access.ts` (loaders,
    `assertGamesCreatable`, `throwGameDenial`), `games.queries.ts` (single
    include, `buildGamesWhere`, order, pair/summary queries),
    `games.mapper.ts` (`toPublicGameItem`, `toAdminGameItem`).
- Planned (not implemented): `standings/`, `brackets/`, `player-stats/`.

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
  (`BLOCKER`), and `HAS_GAMES` (`BLOCKER`, the league has any game). Render `lock.message`; use `lock.code` for icon/color.
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
  `GET .../groups/unassigned-teams` is a read and is allowed in every league
  status (including `FINISHED`).
  Switching format to `KNOCKOUT_ONLY` with groups, or to
  `SINGLE_GROUP_KNOCKOUT` with more than one group, returns 409.
- Group lock: once a group has games, its name and `qualifiersOverride` stay
  editable, but assign, move, remove and delete return 409 `group.hasGames`.
  Re-assigning a team to the group it already belongs to is idempotent and is
  not blocked by the group lock.
  Admin group items carry `lock` (`HAS_GAMES` or `null`).
- Games exist only in `ACTIVE` leagues with a group format. One pure function
  (`evaluateGameActions`) decides `schedule`, `start`, `cancel`, `result` and
  `delete`; its output feeds both the admin lock fields (`scheduleLock`,
  `startLock`, `cancelLock`, `resultLock`, `deleteLock`) and the service errors.
  Denials: `FINISHED`, `LEAGUE_NOT_ACTIVE`, `STATUS_LOCKED`, `HAS_REPLACEMENT`
  (`DEPENDENT_STARTED` is reserved for Stage 5).
- State machine: `SCHEDULED` → `LIVE`/`CANCELED`, `LIVE` → `CANCELED`; `FINISHED`
  only through result entry and back to `SCHEDULED` only through
  `DELETE .../result`; a `FINISHED` game is never canceled and a `CANCELED`
  game has no transitions (a replay is a new game with `rescheduledFromGameId`).
- Results: `NORMAL` (non-negative integer scores, no ties) or `FORFEIT` (stored
  as 0/20). Admin items carry `issues`: `RESULT_PENDING`, `UNSCHEDULED`
  (produced only for `SCHEDULED` and `LIVE` games), `HOME_AWAY_NOT_SWAPPED`
  (second game of a `DOUBLE_ROUND` pair with the same
  home team), `OUTSIDE_LEAGUE_PERIOD`. The list `summary` has zero-filled
  `byStatus`, `resultPending`, `unfinished` and `issues` (`UNFINISHED_GAMES`).
- A league with games can only move between `ACTIVE` and `FINISHED` (409
  `league.hasGames` otherwise) and cannot be deleted.

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
