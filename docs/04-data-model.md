# Data Model

## People & Auth

- `User` — central identity: profile, credentials, refresh token, status.
- `UserRole` — static role assignments, unique `[userId, role]`.
- `UserAdmin` — admin level (1-1 with `User`), separate from domain roles.
- `AdminPermission` — fine-grained permission strings per `UserAdmin`, unique `[userAdminId, permission]`.
- `Player` — 1-1 player profile extension of `User`.
- `Coach` — 1-1 coach profile with `CoachDegree`.
- `Referee` — 1-1 referee profile with `RefreeLevel`.

## Competition Structure

- `Season` — standalone timebox (`startDate`/`endDate` required, `isActive`); no `organizationId`.
- `Organization` — club with status; owns teams.
- `OrganizationManager` — join `Organization`–`User`, unique `[organizationId, userId]`.

## Teams & Rosters

- `Team` — belongs to `Organization`; has `foundedDate`, `logoUrl`, status.
- `TeamSeasonMember` — unified roster row for coaches and players per team-season-user.

## Key decisions

- Roles are a static `Role` enum (`ORG_MANAGER, COACH, PLAYER, REFEREE`); admin power comes from `AdminLevel` + `AdminPermission` strings, not a dynamic RBAC table.
- Coaches are seasonal roster members via unified `TeamSeasonMember` (`role` enum, `isHeadCoach`, `jerseyNumber`), not a separate `team_coaches` table.
- `Season` is standalone; there is no `League` or `LeagueSeason` join table.
- No `Game`, series, or `player_game_stats` tables exist yet; media is URL strings (`avatarUrl`, `photoUrl`, `logoUrl`), not a table.

See `src/prisma/schema.prisma` for exact fields, uniques, and relations.
