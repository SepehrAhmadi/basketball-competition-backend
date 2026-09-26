# Roadmap (backend only)

- Competition: decide `League` + join-table design vs `Season`-only; implement `competition/` module.
- Games: add `Game`/series models, scheduling, results, referee assignment endpoints.
- Stats: add atomic per-player-per-game table plus report aggregations.
- Media: decide dedicated module vs current inline uploader + URL-string approach.
- Seasons: schedule `deactivateExpiredSeasons()` via cron.
- Permissions: expand `PERMISSION_CATALOG` beyond users/teams/seasons as new modules land.
