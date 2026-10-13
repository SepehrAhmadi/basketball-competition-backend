import "./swagger/zod-extend.ts";
import "dotenv/config";
import app from "./app.ts";
import { startLeagueLifecycleJob } from "./modules/competition/shared/league.lifecycle.ts";

const PORT = process.env.PORT || 8081;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Lifecycle (single description lives in league.lifecycle.ts): REGISTRATION
// always carries a today-or-future deadline; once it passes, the job below
// promotes to ACTIVE when requirements hold (≥2 teams, each with ≥1 player).
// Reads never write. Manual admin changes always remain possible (override),
// except FINISHED which only SUPER_ADMIN may reopen.
const LEAGUE_LIFECYCLE_INTERVAL_MS = 90 * 1000;
startLeagueLifecycleJob(LEAGUE_LIFECYCLE_INTERVAL_MS);
