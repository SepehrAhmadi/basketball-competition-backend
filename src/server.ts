import "./swagger/zod-extend.ts";
import "dotenv/config";
import app from "./app.ts";
import { autoAdvanceExpiredRegistrations } from "./modules/competition/shared/league.auto.ts";

const PORT = process.env.PORT || 8081;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Lifecycle: no deadline → INACTIVE; today/future deadline → REGISTRATION;
// past deadline → ACTIVE (if requirements hold). Background sweep every
// 10 minutes; reads also advance best-effort. Manual status changes by an
// admin always remain possible (override).
const LEAGUE_AUTO_ADVANCE_MS = 10 * 60 * 1000;
setInterval(() => {
  autoAdvanceExpiredRegistrations().catch((err) => {
    console.error("[league-auto-advance]", err);
  });
}, LEAGUE_AUTO_ADVANCE_MS).unref?.();
