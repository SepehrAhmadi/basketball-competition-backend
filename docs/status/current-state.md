# Current State

| Module | Backend Status | Frontend Status |
|---|---|---|
| organizations | ✅ Done | Out of scope |
| seasons | ✅ Done | Out of scope |
| teams | ✅ Done | Out of scope |
| auth | ✅ Done | Out of scope |
| user | ✅ Done | Out of scope |
| admin-users | ✅ Done | Out of scope |
| players | ✅ Done | Out of scope |
| coaches | ✅ Done | Out of scope |
| referees | ✅ Done | Out of scope |
| roles | ✅ Done | Out of scope |
| coach-degrees | ✅ Done | Out of scope |
| referee-levels | ✅ Done | Out of scope |
| competition | ❌ Not Started | Out of scope |
| games / series | ❌ Not Started | Out of scope |
| stats | ❌ Not Started | Out of scope |
| media / uploads | ⏳ In Progress (infra only, no module) | Out of scope |

Based on mounted routes in `src/routes/index.ts` and existing service files.

## Known Issues Fixed

- Prisma v7 MariaDB driver adapter wired via `PrismaMariaDb` in `db.config.ts`.
- ESM `.ts` import suffixes with `moduleFormat = "esm"` generator.
- `founded_year` (Int) migrated to `founded_date` (DATE).
- `TeamSeasonMember.status` added (`ACTIVE` default).
- Admin level separated from `Role` into `UserAdmin` + `AdminPermission` (migration `20260926072520`).
