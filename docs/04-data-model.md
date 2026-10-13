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

- `League` — belongs to `AgeCategoryCutoff` (season + category derived, no `seasonId` column); name unique per cutoff; status `INACTIVE`/`REGISTRATION`/`ACTIVE`/`FINISHED` (default `INACTIVE`); dates + `rosterDeadline` as `@db.Date`.
- `LeagueTeam` — registration join `League`–`Team`, unique `[leagueId, teamId]`; soft-delete via `DELETED` (reactivation starts with an empty roster).
- `LeagueTeamMember` — league roster selection of `TeamSeasonMember`, unique `[leagueTeamId, teamSeasonMemberId]`, index on `teamSeasonMemberId`; soft-delete via `DELETED`.

## Key decisions

- Roles are a static `Role` enum (`COACH, PLAYER, REFEREE`); organization management is the `OrganizationManager` relation, not a role; admin power comes from `AdminLevel` + `AdminPermission` strings, not a dynamic RBAC table.
- Coaches are seasonal roster members via unified `TeamSeasonMember` (`role` enum, `isHeadCoach`, `jerseyNumber`), not a separate `team_coaches` table.
- `Season` is standalone; a league's season is derived through its cutoff (`league.ageCategoryCutoff.season`).
- League roster is a selection of `TeamSeasonMember` rows, not a copy; jersey numbers stay on the team roster.
- No `Game`, series, or `player_game_stats` tables exist yet; media is URL strings (`avatarUrl`, `photoUrl`, `logoUrl`), not a table.

See `src/prisma/schema.prisma` for exact fields, uniques, and relations.
