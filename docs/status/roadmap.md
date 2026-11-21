# Roadmap (backend only)

- Leagues: leagues / league-teams / league-roster / competition format / groups / games / standings done; brackets and player stats next.
- Competition: format (Stage 1), groups (Stage 2), games (Stage 3) and standings (Stage 4) done; `HAS_GAMES` locks format, group composition and league status/delete. Next: brackets (Stage 5, which also emits `DEPENDENT_STARTED`).
- Games: series and referee assignment endpoints remain.
- Stats: add atomic per-player-per-game table plus report aggregations.
- Media: decide dedicated module vs current inline uploader + URL-string approach.
- Seasons: schedule `deactivateExpiredSeasons()` via cron.
- Permissions: `leagues.*`, `league-teams.*`, `league-roster.*`, `competition.*`, `groups.*`, `games.*` added; expand further as games/stats land.
