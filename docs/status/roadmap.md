# Roadmap (backend only)

- Leagues: leagues / league-teams / league-roster done; groups, series, games next.
- Games: add `Game`/series models, scheduling, results, referee assignment endpoints.
- Stats: add atomic per-player-per-game table plus report aggregations.
- Media: decide dedicated module vs current inline uploader + URL-string approach.
- Seasons: schedule `deactivateExpiredSeasons()` via cron.
- Permissions: `leagues.*`, `league-teams.*`, `league-roster.*` added; expand further as games/stats land.
