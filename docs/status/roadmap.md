# Roadmap (backend only)

- Leagues: leagues / league-teams / league-roster / competition format / groups done; games, standings, brackets and player stats next.
- Competition: format (Stage 1) and groups (Stage 2) done, including the format-change guards. Games (Stage 3) enable the `HAS_GAMES` format lock and activate the existing `TODO(Game)` guards.
- Games: add `Game`/series models, scheduling, results, referee assignment endpoints.
- Stats: add atomic per-player-per-game table plus report aggregations.
- Media: decide dedicated module vs current inline uploader + URL-string approach.
- Seasons: schedule `deactivateExpiredSeasons()` via cron.
- Permissions: `leagues.*`, `league-teams.*`, `league-roster.*`, `groups.*` added; expand further as games/stats land.
