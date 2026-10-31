# Data Model

## People & Auth

- `User` — central identity: profile, credentials, refresh token, status.
- `UserRole` — static role assignments, unique `[userId, role]`.
- `UserAdmin` — admin level (1-1 with `User`), separate from domain roles.
- `AdminPermission` — fine-grained permission strings per `UserAdmin`, unique `[userAdminId, permission]`.
- `Player` — 1-1 player profile extension of `User`.
- `Coach` — 1-1 coach profile with `CoachDegree`.
- `Referee` — 1-1 referee profile with `RefreeLevel`.

## Leagues Structure

- `Season` — standalone timebox (`startDate`/`endDate` required, `isActive`); no `organizationId`; has `members` + `ageCategoryCutoffs` relations.
- `Organization` — club with status; owns `teams` + `teamSeasonMembers`.
- `OrganizationManager` — join `Organization`–`User`, unique `[organizationId, userId]`.
- `AgeCategory` — unique `name` + `createdAt`/`updatedAt`; has `cutoffs` relation.
- `AgeCategoryCutoff` — per-season eligibility (`ageCategoryId`, `seasonId`, `minBirthDate @db.Date`); unique `[ageCategoryId, seasonId]`, index on `seasonId`.

## Teams & Rosters

- `Team` — belongs to `Organization`; has `foundedDate @db.Date`, `logoUrl`, status; has `leagueTeams` relation.
- `TeamSeasonMember` — unified roster row for coaches and players per team-season-user; unique `[teamId, seasonId, userId, role]` + unique `[teamId, seasonId, jerseyNumber]`; `isHeadCoach` default false, `status` default `ACTIVE` (soft-delete via `DELETED` + reactivation); has `leagueMemberships` relation.

## Leagues

- `League` — belongs to `AgeCategoryCutoff` (season + category derived, no `seasonId` column); name unique per cutoff; status `INACTIVE`/`REGISTRATION`/`ACTIVE`/`FINISHED` (default `INACTIVE`); dates + `rosterDeadline` as `@db.Date`; competition settings `format` (`LeagueFormat?`), `winPoints` (default 2), `lossPoints` (default 1), `groupRoundType` (`GroupRoundType?`) and `defaultQualifiersPerGroup` (Int?).
- `LeagueTeam` — registration join `League`–`Team`, unique `[leagueId, teamId]`; soft-delete via `DELETED` (reactivation starts with an empty roster); has optional `groupTeam` back-relation.
- `LeagueTeamMember` — league roster selection of `TeamSeasonMember`, unique `[leagueTeamId, teamSeasonMemberId]`, index on `teamSeasonMemberId`; soft-delete via `DELETED`.
- `Group` (`league_groups`) — group of a league: `leagueId`, unique `leagueId`+`name`, `qualifiersOverride`; has `teams` relation.
- `GroupTeam` (`league_group_teams`) — placement join `Group`–`LeagueTeam`: `groupId` (index), unique `leagueTeamId` (one group per league team).

## Key decisions

- Roles are a static `Role` enum (`COACH, PLAYER, REFEREE`); organization management is the `OrganizationManager` relation, not a role; admin power comes from `AdminLevel` + `AdminPermission` strings, not a dynamic RBAC table.
- Coaches are seasonal roster members via unified `TeamSeasonMember` (`role` enum, `isHeadCoach`, `jerseyNumber`), not a separate `team_coaches` table.
- `Season` is standalone; a league's season is derived through its cutoff (`league.ageCategoryCutoff.season`).
- League roster is a selection of `TeamSeasonMember` rows, not a copy; jersey numbers stay on the team roster.
- Format is a setting on `League`, not a separate entity: `LeagueFormat` (`GROUPS_KNOCKOUT`, `SINGLE_GROUP_KNOCKOUT`, `KNOCKOUT_ONLY`) with `GroupRoundType` (`ONE_ROUND`, `DOUBLE_ROUND`). `format = null` means the structure is not configured yet; group fields are non-null only for group formats; `winPoints`/`lossPoints` are always stored. Groups are `Group` rows with per-group `qualifiersOverride`; placement is manual via `GroupTeam` (upsert assign/move, `DELETE` remove). Unregister hard-deletes the `GroupTeam` row, so re-registration starts unassigned and restores never leak the old group. Deleting a group unassigns its teams first; deleting a league deletes groups first (`P2003` otherwise).
- No `Game`, series, or `player_game_stats` tables exist yet; media is URL strings (`avatarUrl`, `photoUrl`, `logoUrl`), not a table.
- Teams in `REGISTRATION`/`ACTIVE` leagues cannot be soft-deleted (409 `inOpenLeague`, no admin bypass); responses carry a `BLOCKER` `lock` and `can.delete` is derived as `policy.delete && !locked`.

See `src/prisma/schema.prisma` for exact fields, uniques, and relations.
