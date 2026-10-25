# Roadmap (backend only)

- Leagues: leagues / league-teams / league-roster / competition format done; groups next, then games, standings, brackets and player stats.
- Competition: format (Stage 1) done. Groups (Stage 2) add `Group` rows and the `TODO(Group)` guard; games (Stage 3) enable the `HAS_GAMES` format lock and activate the existing `TODO(Game)` guards.
- Games: add `Game`/series models, scheduling, results, referee assignment endpoints.
- Stats: add atomic per-player-per-game table plus report aggregations.
- Media: decide dedicated module vs current inline uploader + URL-string approach.
- Seasons: schedule `deactivateExpiredSeasons()` via cron.
- Permissions: `leagues.*`, `league-teams.*`, `league-roster.*` added; expand further as games/stats land.
