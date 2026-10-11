# League Module — Backend Implementation Plan

Target: `basketball-competition-backend` (Express 5 + TypeScript ESM + Prisma 7 / MariaDB adapter + Zod + zod-to-openapi).
Scope: **League only** — leagues, league teams (registration), league roster. Groups, games, series, stats, standings are OUT of scope (see section 10 for the hooks we leave).

---

## 1. Product decisions this plan implements

| # | Decision |
|---|---|
| 1 | A season can host many leagues. A league belongs to exactly one season and one age category, **both derived from `AgeCategoryCutoff`** (`League.ageCategoryCutoffId`). No `seasonId` column on League. Many leagues may share one cutoff. |
| 2 | Only admins create / edit / delete leagues and change their status (admin panel). |
| 3 | League statuses: `INACTIVE` (hidden, default on create), `REGISTRATION`, `ACTIVE` (in progress), `FINISHED`. |
| 4 | Teams are registered in a league by the **organization manager** (app) or by an **admin** (admin panel). |
| 5 | A team is registrable only if: its organization is ACTIVE and managed by the caller (admin exempt from the manager check), the team is ACTIVE, and it has at least one ACTIVE `TeamSeasonMember` in the league's season. |
| 6 | League roster = a **selection** of members from the team's season roster (`TeamSeasonMember`). Team module structure is unchanged. Jersey number is read from the team roster (no league-level jersey). |
| 7 | League roster is editable by the manager only while league status is `REGISTRATION` and `rosterDeadline` has not passed. Admin can edit in `REGISTRATION` and `ACTIVE`, ignoring the deadline. |
| 8 | Age rule (applies to admin too): a PLAYER is eligible only if `birthDate` exists and `birthDate >= cutoff.minBirthDate`. COACH has no age rule. |
| 9 | A PLAYER can be in only one ACTIVE team of the same league (checked in service). |
| 10 | League roster (names, avatars, role, jersey, head-coach flag) is **public**. Phone, email, national id, birth date are never exposed on public/app responses. |
| 11 | Public endpoints (no JWT required) list leagues with status filter; `INACTIVE` leagues are never public. |
| 12 | A user sees "my leagues" (leagues where they manage a registered team or are in a league roster). Coach/player sees only their own team; manager sees own organization teams and can edit while registration is open. |
| 13 | Min requirements (>= 2 teams, each team >= 1 player) are checked only when moving the league to `ACTIVE`. |

---

## 2. Conventions the agent MUST follow (taken from the existing codebase)

- ESM, explicit `.ts` import suffixes everywhere. `export default {}` objects for controllers/services/validation.
- Layering: `routes → controller (req/res only) → service (logic + Prisma)`; `*.validation.ts` (Zod input) and `*.docs.ts` (response schemas + `registry.registerPath`); `*.policy.ts` for contextual rules (pure, no DB).
- Every `*.validation.ts` starts with `import "<rel>/swagger/zod-extend.ts";`.
- All user-facing strings come from `src/language/message.ts` (Persian). The only allowed inline strings are the existing English validation fallbacks (`"At least one field must be provided"`, `"The value must be a number"`, date refine messages).
- Controllers read input from `req.validatedBody ?? req.body`, `req.validatedQuery ?? req.query`, params via `Number(req.params.x)`.
- Success: `apiResponse.sendResponse(res, status, message, data)`. Errors: `throw new AppError(status, message)`.
- 404 is always checked before 403. Prisma `P2002`/`P2003`/`P2025` are mapped to `AppError` in services.
- Pagination: `paginationQuerySchema` and response shape `{ items, total, page, pageSize }`; list queries use `prisma.$transaction([findMany, count])`.
- Jalali `YYYY/MM/DD` strings at the API boundary, `jalaliToGregorian` / `gregorianToJalali` from `src/utils/date.util.ts`, stored as UTC-noon `@db.Date`.
- Public file URLs through `getPublicFileUrl(url, process.env.BASE_URL)`.
- Admin routers: `router.use(verifyJWT); router.use(verifyAdminLevel("ADMIN","SUPER_ADMIN"));` then per route `verifyPermission(...)` before `validate(...)`.
- Do NOT modify infrastructure (`db.config.ts`, `validate.ts`, `errorHandler.ts`, `createUploader.ts`, auth middlewares). Only consume them.
- No new env vars, no new dependencies.
- After each task: run `npx tsc --noEmit` and fix errors before moving on.

---

## 3. Target file layout

```
src/modules/competition/
├── shared/
│   ├── league.rules.ts        # pure helpers (status transitions, roster window, age eligibility, Tehran date)
│   └── league.mapper.ts       # prisma includes + response mappers (league, team item, member item)
├── leagues/                   # app side (public + authenticated)
│   ├── leagues.routes.ts
│   ├── leagues.controller.ts
│   ├── leagues.service.ts        # public reads, my leagues
│   ├── league-teams.service.ts   # registration + roster operations (actor-aware; reused by admin)
│   ├── leagues.policy.ts
│   ├── leagues.validation.ts
│   └── leagues.docs.ts
└── admin/
    ├── leagues/               # admin CRUD + status
    │   ├── leagues.admin.routes.ts
    │   ├── leagues.admin.controller.ts
    │   ├── leagues.admin.service.ts
    │   ├── leagues.admin.validation.ts
    │   └── leagues.admin.docs.ts
    └── league-teams/          # admin teams + roster inside a league (thin wrappers over league-teams.service)
        ├── league-teams.admin.routes.ts      # Router({ mergeParams: true })
        ├── league-teams.admin.controller.ts
        ├── league-teams.admin.service.ts
        ├── league-teams.admin.validation.ts
        └── league-teams.admin.docs.ts

src/modules/shared/league-statuses/   # public static enum endpoint (same pattern as coach-degrees)
├── league-statuses.routes.ts
├── league-statuses.controller.ts
├── league-statuses.service.ts
└── league-statuses.docs.ts
```

Depth note: files under `competition/admin/<sub>/` use `../../../../` to reach `src/`; files under `competition/leagues/` and `competition/shared/` use `../../../`; files under `modules/shared/league-statuses/` use `../../../`.

---

## 4. Data model (Prisma) — `src/prisma/schema.prisma`

Add enums and models, then add the three back-relations on existing models.

```prisma
enum LeagueStatus {
  INACTIVE
  REGISTRATION
  ACTIVE
  FINISHED
}

enum LeagueTeamStatus {
  ACTIVE
  DELETED
}

enum LeagueTeamMemberStatus {
  ACTIVE
  DELETED
}

model League {
  id                  Int          @id @default(autoincrement())
  name                String
  ageCategoryCutoffId Int          @map("age_category_cutoff_id")
  status              LeagueStatus @default(INACTIVE)
  startDate           DateTime?    @map("start_date") @db.Date
  endDate             DateTime?    @map("end_date") @db.Date
  rosterDeadline      DateTime?    @map("roster_deadline") @db.Date
  description         String?      @db.Text
  createdAt           DateTime     @default(now()) @map("created_at")
  updatedAt           DateTime     @updatedAt @map("updated_at")

  ageCategoryCutoff AgeCategoryCutoff @relation(fields: [ageCategoryCutoffId], references: [id])
  teams             LeagueTeam[]

  @@unique([ageCategoryCutoffId, name])
  @@map("leagues")
}

model LeagueTeam {
  id        Int              @id @default(autoincrement())
  leagueId  Int              @map("league_id")
  teamId    Int              @map("team_id")
  status    LeagueTeamStatus @default(ACTIVE)
  createdAt DateTime         @default(now()) @map("created_at")

  league  League             @relation(fields: [leagueId], references: [id])
  team    Team               @relation(fields: [teamId], references: [id])
  members LeagueTeamMember[]

  @@unique([leagueId, teamId])
  @@map("league_teams")
}

model LeagueTeamMember {
  id                 Int                    @id @default(autoincrement())
  leagueTeamId       Int                    @map("league_team_id")
  teamSeasonMemberId Int                    @map("team_season_member_id")
  status             LeagueTeamMemberStatus @default(ACTIVE)
  createdAt          DateTime               @default(now()) @map("created_at")

  leagueTeam       LeagueTeam       @relation(fields: [leagueTeamId], references: [id])
  teamSeasonMember TeamSeasonMember @relation(fields: [teamSeasonMemberId], references: [id])

  @@unique([leagueTeamId, teamSeasonMemberId])
  @@index([teamSeasonMemberId])
  @@map("league_team_members")
}
```

Back-relations (no DB column changes):
- `AgeCategoryCutoff`: `leagues League[]`
- `Team`: `leagueTeams LeagueTeam[]`
- `TeamSeasonMember`: `leagueMemberships LeagueTeamMember[]`

All FKs stay default (`ON DELETE RESTRICT`), consistent with the project. This means deleting a cutoff / season / team that is referenced already yields `P2003`, which existing services map to 409.

---

## 5. Business rules (single source of truth for the services)

### 5.1 Derived values
- `season` of a league = `league.ageCategoryCutoff.season`; `ageCategory` = `league.ageCategoryCutoff.ageCategory`; `minBirthDate` = `league.ageCategoryCutoff.minBirthDate`.

### 5.2 League status machine (admin only, `PATCH /admin/leagues/:leagueId/status`)
- Allowed values: `INACTIVE | REGISTRATION | ACTIVE | FINISHED`. Same-status request is a no-op (return the league, no write).
- Transitions are free **except**:
  - → `ACTIVE`: requires >= 2 ACTIVE `LeagueTeam` rows (whose `team.status != DELETED`) AND each of them has >= 1 ACTIVE `LeagueTeamMember` whose `teamSeasonMember.role = PLAYER`. Else 409 (`minTeamsRequired` / `teamWithoutPlayers`).
  - From `FINISHED` to anything else: only `adminLevel === "SUPER_ADMIN"`, else 403 (`statusChangeForbidden`). The service receives `adminLevel` from the controller (`req.adminLevel`).
  - Leaving `ACTIVE` backwards (to `REGISTRATION`/`INACTIVE`): allowed now; add a stub `assertNoGames(leagueId)` called here with `// TODO(Game): block with 409 once games exist` (same style as `assertCutoffEditable`).

### 5.3 League edit rules (`PUT /admin/leagues/:leagueId`)
- 404 if missing. If `status === FINISHED` → 409 `finishedLocked`.
- `ageCategoryCutoffId` may change only when the league has **no ACTIVE `LeagueTeam`** and status is not `ACTIVE`; otherwise 409 `cutoffLocked`. New cutoff must exist (404 `ageCategoryCutoff.notFound`).
- Name unique per cutoff: pre-check with `findFirst({ where: { ageCategoryCutoffId: finalCutoffId, name, id: { not } } })` → 409 `nameExists`; also map `P2002` → 409 `nameExists`.
- Date order: `endDate >= startDate` using the final (merged) values compared as `Date`; else 400 `endDateBeforeStartDate`.
- Skip the write when nothing actually changed (keeps `updatedAt`), like `updateCutoff`.
- Status is never changed through PUT.

### 5.4 League delete (`DELETE /admin/leagues/:leagueId`)
- 404 if missing. Status must be `INACTIVE` or `REGISTRATION`, else 409 `deleteNotAllowed`.
- If any **ACTIVE** `LeagueTeam` exists → 409 `hasTeams`.
- Otherwise, in one `$transaction`: `deleteMany` `LeagueTeamMember` where `leagueTeam.leagueId = id`, `deleteMany` `LeagueTeam` where `leagueId = id` (only DELETED rows can remain), then `delete` the league. Map `P2003` → 409 `hasDependents` (future games/groups).

### 5.5 Roster window (pure helper in `league.rules.ts`)
- `isRosterWindowOpen(rosterDeadline: Date | null, now = new Date())`: `true` if deadline is null; else compare `YYYY-MM-DD` strings: `todayInTehran <= rosterDeadline.toISOString().slice(0,10)`, where `todayInTehran = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(now)`. (Stored dates are UTC noon, so the ISO date equals the intended Gregorian date. The deadline is inclusive for the whole day.)
- The same window governs **team registration, team withdrawal and roster edits** by managers.
- `canEditByStatus(status, isAdmin)`: manager → `status === "REGISTRATION"`; admin → `status in ["REGISTRATION","ACTIVE"]`.

### 5.6 Team registration (`registerTeam(leagueId, teamId, actor)`)
Order of checks:
1. League exists (non-admin: status must not be `INACTIVE`, else 404).
2. Team exists and `status !== DELETED` → else 404 `team.notFound`.
3. Identity: non-admin must have `team.organizationId ∈ actor.managedOrgIds` → else 403 `league.notAuthorized`.
4. Status: `canEditByStatus` → else 409 `league.registrationClosed`.
5. Window: non-admin and `!isRosterWindowOpen` → 409 `league.rosterClosed`.
6. Team `status === ACTIVE` and organization `status === ACTIVE` → else 400 `leagueTeam.teamNotActive`.
7. Team has >= 1 ACTIVE `TeamSeasonMember` (user `status ACTIVE`) with `seasonId = league season` → else 400 `leagueTeam.noSeasonRoster`.
8. Existing `LeagueTeam(leagueId, teamId)`: ACTIVE → 409 `alreadyRegistered`; DELETED → reactivate (`status ACTIVE`; its members are already DELETED, roster starts empty); none → create. Map `P2002` → 409.
Returns the mapped league-team item with its `can`.

### 5.7 Team withdrawal (`unregisterTeam(leagueId, leagueTeamId, actor)`)
- League 404, LeagueTeam must be ACTIVE and belong to the league (404 `leagueTeam.notFound`), identity (manager of the team's org or admin), status + window rules like 5.6.
- In one `$transaction`: `LeagueTeam.status = DELETED` and `updateMany` all its ACTIVE `LeagueTeamMember` → `DELETED`.

### 5.8 Roster candidates (`listCandidates`)
- Same identity/visibility rules as roster editing for reading (manager of the org or admin); no status/window requirement (read-only).
- Source: `TeamSeasonMember` where `teamId = leagueTeam.teamId`, `seasonId = league season`, `status ACTIVE`, `user.status ACTIVE`; optional `role` and `search` (user `fullName`/`phone` contains).
- Each item: `teamSeasonMemberId`, `userId`, `fullName`, `avatarUrl`, `role`, `jerseyNumber`, `isHeadCoach`, `selected` (ACTIVE `LeagueTeamMember` exists for this leagueTeam), `eligible` boolean, `ineligibleReason: null | "BIRTH_DATE_MISSING" | "TOO_OLD" | "IN_OTHER_TEAM"`.
- Eligibility = role COACH → always eligible; role PLAYER → age rule (5.9) and not ACTIVE in another ACTIVE team of the same league.
- Admin variant additionally returns `phone` and `birthDate` (Jalali).

### 5.9 Add roster members (`addMembers(leagueId, leagueTeamId, teamSeasonMemberIds, actor)`)
Checks (identity, status, window as in 5.6; LeagueTeam must be ACTIVE and belong to league):
1. Dedupe ids. Load `TeamSeasonMember` rows with `id in ids`, `teamId = leagueTeam.teamId`, `seasonId = league season`, `status ACTIVE`, `user.status ACTIVE`. Count mismatch → 404 `leagueRoster.teamMemberNotFound`.
2. For each PLAYER: `birthDate` null → 400 `birthDateRequired`; `birthDate.getTime() < minBirthDate.getTime()` → 400 `ageIneligible`; player (by `userId`) already ACTIVE in another ACTIVE `LeagueTeam` of this league → 409 `playerInOtherTeam`.
3. Existing `LeagueTeamMember` row: ACTIVE → 409 `alreadyInRoster`; DELETED → reactivate; none → create.
4. All-or-nothing inside one `$transaction`; map `P2002` → 409 `alreadyInRoster`.
Returns the mapped members (201).

### 5.10 Remove roster member (`removeMember`)
- Identity/status/window as above. `LeagueTeamMember` must be ACTIVE and belong to that leagueTeam (404 `leagueRoster.notFound`). Soft-delete (`status = DELETED`).

### 5.11 Visibility
- Public/app endpoints: league `status = INACTIVE` → 404 for everyone (admins use admin endpoints).
- Public team lists exclude `LeagueTeam.status = DELETED` and teams with `team.status = DELETED`.
- Public/app member lists: only ACTIVE members; safe fields only (section 7.4).
- **Do not use `Actor.memberTeamIds`/`membershipFor` for league access** — they only contain memberships of the *active* season, and leagues may belong to other seasons. Use `actor.managedOrgIds` (not season-limited) and direct DB queries for membership.

### 5.12 Policy (`leagues.policy.ts`, pure)
```
LeagueCan      { view: boolean; registerTeam: boolean }
LeagueTeamCan  { manageRoster: boolean; unregister: boolean }
leaguePolicy(actor, league: { status, rosterDeadline }): LeagueCan
leagueTeamPolicy(actor, league: { status, rosterDeadline }, organizationId): LeagueTeamCan
```
- `view`: `status !== INACTIVE || actor.isAdmin`.
- `registerTeam` (league level, approximate): admin → `canEditByStatus`; non-admin → `status === REGISTRATION && window open && actor.managedOrgIds.size > 0`; guest → false. Exact eligibility comes from `eligible-teams`.
- `manageRoster` / `unregister`: admin → `canEditByStatus(status, true)`; manager of `organizationId` → `canEditByStatus(status, false) && window open`; else false.
- Services re-derive and enforce; `can` is output-only (per `docs/09-authorization.md`).

---

## 6. Tasks (execute in order; one task at a time)

### Task 1 — Schema + migration
- Edit `src/prisma/schema.prisma` exactly as section 4.
- Run `npx prisma migrate dev --name add_leagues` and `npx prisma generate`. Verify the SQL creates `leagues`, `league_teams`, `league_team_members` with the unique indexes and RESTRICT FKs.
- Done when: `npx tsc --noEmit` passes and `prisma.league`, `prisma.leagueTeam`, `prisma.leagueTeamMember` exist on the client.

### Task 2 — Messages
Add to `src/language/message.ts` (keep `as const`, keep the existing grouping style).

`messages.error.league`:
`nameRequired` "نام لیگ الزامی است"; `notFound` "لیگ یافت نشد"; `nameExists` "لیگ دیگری با این نام در همین رده سنی و فصل ثبت شده است"; `cutoffLocked` "پس از ثبت‌نام تیم، حدنصاب سنی لیگ قابل تغییر نیست"; `finishedLocked` "لیگ تمام‌شده قابل ویرایش نیست"; `deleteNotAllowed` "فقط لیگ غیرفعال یا در حال ثبت‌نام قابل حذف است"; `hasTeams` "این لیگ دارای تیم ثبت‌نام‌شده است و قابل حذف نیست"; `hasDependents` "این لیگ دارای رکورد وابسته است و قابل حذف نیست"; `minTeamsRequired` "برای شروع لیگ حداقل دو تیم ثبت‌نام‌شده لازم است"; `teamWithoutPlayers` "هر تیم برای شروع لیگ باید حداقل یک بازیکن در راستر داشته باشد"; `statusChangeForbidden` "تغییر وضعیت این لیگ فقط توسط سوپر ادمین مجاز است"; `registrationClosed` "ثبت‌نام و ویرایش راستر در وضعیت فعلی لیگ امکان‌پذیر نیست"; `rosterClosed` "مهلت ثبت‌نام و ویرایش راستر این لیگ به پایان رسیده است"; `notAuthorized` "شما مجاز به انجام این عملیات در این لیگ نیستید"; `endDateBeforeStartDate` "تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.".

`messages.error.leagueTeam`:
`notFound` "تیم در این لیگ یافت نشد"; `alreadyRegistered` "این تیم قبلاً در این لیگ ثبت‌نام شده است"; `teamNotActive` "تیم یا سازمان آن فعال نیست"; `noSeasonRoster` "این تیم در فصل این لیگ راستر فعالی ندارد".

`messages.error.leagueRoster`:
`notFound` "عضو راستر لیگ یافت نشد"; `teamMemberNotFound` "عضو انتخاب‌شده در راستر فعال این تیم در فصل لیگ یافت نشد"; `alreadyInRoster` "این عضو قبلاً در راستر لیگ ثبت شده است"; `birthDateRequired` "تاریخ تولد بازیکن ثبت نشده است"; `ageIneligible` "سن بازیکن با رده سنی این لیگ مطابقت ندارد"; `playerInOtherTeam` "این بازیکن در تیم دیگری از همین لیگ ثبت شده است".

`messages.error.team` — add `memberInActiveLeague`: "این عضو در راستر لیگی که در جریان یا تمام‌شده است ثبت شده و قابل حذف یا تغییر نیست".

`messages.success`:
- `league`: `list` "لیست لیگ‌ها با موفقیت دریافت شد"; `found` "لیگ با موفقیت دریافت شد"; `created` "لیگ با موفقیت ایجاد شد"; `updated` "لیگ با موفقیت به‌روزرسانی شد"; `deleted` "لیگ با موفقیت حذف شد"; `statusUpdated` "وضعیت لیگ با موفقیت تغییر کرد"; `myList` "لیگ‌های شما با موفقیت دریافت شد".
- `leagueStatuses`: `fetched` "وضعیت‌های لیگ با موفقیت دریافت شد".
- `leagueTeam`: `list` "لیست تیم‌های لیگ با موفقیت دریافت شد"; `eligibleList` "لیست تیم‌های قابل ثبت‌نام با موفقیت دریافت شد"; `registered` "تیم با موفقیت در لیگ ثبت‌نام شد"; `removed` "تیم با موفقیت از لیگ حذف شد".
- `leagueRoster`: `list` "راستر لیگ با موفقیت دریافت شد"; `candidates` "لیست اعضای قابل انتخاب با موفقیت دریافت شد"; `added` "اعضا با موفقیت به راستر لیگ اضافه شدند"; `removed` "عضو با موفقیت از راستر لیگ حذف شد".

Reuse existing keys where they fit: `ageCategoryCutoff.notFound`, `team.notFound`.

### Task 3 — Permissions
In `src/shared/permissions.ts` append three groups to `PERMISSION_CATALOG` (keep `as const`, Persian titles/labels):
- "لیگ‌ها": `leagues.view` مشاهده لیگ‌ها, `leagues.create` ایجاد لیگ, `leagues.update` ویرایش لیگ, `leagues.delete` حذف لیگ.
- "ثبت‌نام تیم در لیگ": `league-teams.view` مشاهده تیم‌های لیگ, `league-teams.create` ثبت‌نام تیم در لیگ, `league-teams.delete` حذف تیم از لیگ.
- "راستر لیگ": `league-roster.view` مشاهده راستر لیگ, `league-roster.create` افزودن عضو به راستر لیگ, `league-roster.delete` حذف عضو از راستر لیگ.
Status change uses `leagues.update`. Note: ADMIN tokens carry permissions baked in; a SUPER_ADMIN must grant the new codes via `PUT /admin/users/:id/permissions` and the admin must re-login/refresh. SUPER_ADMIN bypasses automatically.

### Task 4 — Shared helpers (`competition/shared`)
`league.rules.ts` (pure, no Prisma):
- `isRosterWindowOpen(rosterDeadline, now?)`, `canEditByStatus(status, isAdmin)` (section 5.5).
- `isPlayerAgeEligible(birthDate: Date | null, minBirthDate: Date): { ok: true } | { ok: false; reason: "BIRTH_DATE_MISSING" | "TOO_OLD" }`.
- `LEAGUE_STATUS_VALUES` constant tuple for Zod enums.

`league.mapper.ts`:
- `leagueInclude`: `{ ageCategoryCutoff: { include: { ageCategory: { select: { id, name } }, season: { select: { id, name } } } }, _count: { select: { teams: { where: { status: "ACTIVE", team: { status: { not: "DELETED" } } } } } } }`.
- `toLeagueResponse(row)` → `{ id, name, description, status, startDate, endDate, rosterDeadline (all Jalali or null via gregorianToJalali), ageCategoryCutoffId, ageCategory, season, minBirthDate (Jalali), teamsCount, createdAt, updatedAt }`.
- `toLeagueTeamItem(row, can?)` → `{ id, status, team: { id, name, logoUrl (public URL) }, organization: { id, name }, membersCount?, createdAt, can? }`.
- `toPublicMemberItem(row)` → `{ id, teamSeasonMemberId, userId, fullName, avatarUrl (public URL), role, jerseyNumber, isHeadCoach }`. **Never** include phone/email/nationalId/birthDate. `toAdminMemberItem` = public item + `phone`, `birthDate` (Jalali).

### Task 5 — Admin leagues (CRUD + status)
Folder `competition/admin/leagues/`.

Validation (`leagues.admin.validation.ts`):
- `leagueIdParamSchema` (`leagueId`, coerce int positive) — export it; app and nested admin routers import it.
- `createLeagueSchema` (`.strict()`): `name` (string, trim + map Arabic `ي`→`ی`, `ك`→`ک` in a `.transform`, min 2 with `messages.error.league.nameRequired`, max 100), `ageCategoryCutoffId` (int positive), `startDate?`, `endDate?`, `rosterDeadline?` (Jalali strings, nullable optional, validated through `jalaliToGregorian` like `jalaliDateSchema` in the cutoffs validation), `description?` (string max 5000, nullable optional). No `status` field (always created `INACTIVE`).
- `updateLeagueSchema`: all create fields optional, `.strict()`, `.refine(Object.keys(d).length > 0)`.
- `updateLeagueStatusSchema`: `{ status: z.enum(LEAGUE_STATUS_VALUES) }` `.strict()`.
- `adminLeagueListQuerySchema = paginationQuerySchema.extend({ status?: enum(4), seasonId?, ageCategoryId? (coerce int positive optional), search? })`.

Service (`leagues.admin.service.ts`): `listLeagues`, `getLeagueById`, `createLeague`, `updateLeague`, `deleteLeague`, `updateLeagueStatus(leagueId, status, adminLevel)`.
- List `where`: `status`, `ageCategoryCutoff: { seasonId, ageCategoryId }` (only set when provided), `name contains search.trim()`; `orderBy: [{ id: "desc" }]`; include `leagueInclude`.
- Create: verify cutoff exists (404 `ageCategoryCutoff.notFound`), check date order, duplicate name pre-check + `P2002` → 409; convert Jalali → Date; `status` defaults `INACTIVE`.
- Update/delete/status: rules 5.2–5.4.

Controller + routes (`leagues.admin.routes.ts`): `router.use(verifyJWT)`, `router.use(verifyAdminLevel("ADMIN","SUPER_ADMIN"))`, then
- `GET /` `leagues.view` + query validation
- `GET /:leagueId` `leagues.view`
- `POST /` `leagues.create`
- `PUT /:leagueId` `leagues.update`
- `PATCH /:leagueId/status` `leagues.update`
- `DELETE /:leagueId` `leagues.delete`
(each with `validate(leagueIdParamSchema, "params")` where applicable, then body/query validation).

Docs (`leagues.admin.docs.ts`): register schemas `League`, tag "Admin - Leagues", all paths with 200/201/400/401/403/404/409 responses, using `successResponseSchema`, `errorResponseSchema`, `paginatedResponseSchema`.

### Task 6 — Shared league-teams service + policy (no routes yet)
- `leagues.policy.ts` per 5.12.
- `leagues.validation.ts` (app): export `leagueIdParamSchema` re-export or own copy (prefer importing from admin validation is NOT allowed — define the shared param schemas here and let admin import from here): `leagueIdParamSchema`, `leagueTeamParamSchema` (`leagueId`, `leagueTeamId`), `leagueMemberParamSchema` (`leagueId`, `leagueTeamId`, `memberId`), `registerTeamSchema` `{ teamId }`, `addMembersSchema` `{ teamSeasonMemberIds: array(int positive).min(1).max(50) }` (both `.strict()`), `publicLeagueListQuerySchema` (pagination + `status?` enum of `REGISTRATION|ACTIVE|FINISHED` + `seasonId?` + `ageCategoryId?` + `search?`), `myLeaguesQuerySchema` (pagination + `status?` same 3 values), `leagueTeamsQuerySchema` (pagination + `search?`), `membersQuerySchema` (pagination + `role?` COACH|PLAYER), `candidatesQuerySchema` (membersQuerySchema + `search?`), `eligibleTeamsQuerySchema` (pagination + `search?` + `organizationId?` for admin use).
  Resolve the circularity: `leagues.admin.validation.ts` imports `leagueIdParamSchema` from `competition/leagues/leagues.validation.ts` (admin → app direction only).
- `league-teams.service.ts` (actor-aware; implements 5.6–5.10 and the list queries):
  `listLeagueTeams(leagueId, query, actor)`, `listEligibleTeams(leagueId, query, actor)`, `registerTeam(leagueId, teamId, actor)`, `unregisterTeam(leagueId, leagueTeamId, actor)`, `listMembers(leagueId, leagueTeamId, query, actor, { admin })`, `listCandidates(leagueId, leagueTeamId, query, actor, { admin })`, `addMembers(...)`, `removeMember(...)`.
  - Internal helper `loadLeagueForActor(leagueId, actor)`: loads league + cutoff (season id, `minBirthDate`), 404 if missing or (INACTIVE and not admin).
  - Internal helper `assertCanEdit(actor, league, organizationId)` implementing identity → status → window order (403/409/409).
  - `listEligibleTeams`: teams with `status ACTIVE`, `organization.status ACTIVE`, `members: { some: { seasonId, status: "ACTIVE", user: { status: "ACTIVE" } } }`, scoped to `organizationId in actor.managedOrgIds` for non-admins (all for admin, optional `organizationId` filter); include org + `_count.members` (filtered the same way); mark `alreadyRegistered` from existing ACTIVE `LeagueTeam` rows. Item: `{ team: { id, name, logoUrl }, organization: { id, name }, activeRosterCount, alreadyRegistered }`.
  - `listLeagueTeams`: ACTIVE league teams with `team.status != DELETED`; filter `team.name contains search`; each item with `membersCount` (ACTIVE members) and, for authenticated actors, `can` from `leagueTeamPolicy`.
  - Use `adminActor(callerUserId)` (same shape as in `teams.admin.service.ts`) when called from admin wrappers.

### Task 7 — Admin league-teams (wrappers + routes)
Folder `competition/admin/league-teams/`. The service is a thin wrapper calling `league-teams.service.ts` with `adminActor(req.userId)` and `{ admin: true }`.

Router is created with `Router({ mergeParams: true })` and mounted at `/admin/leagues/:leagueId/teams`. Same guards as other admin routers.
- `GET /` `league-teams.view`
- `POST /` `league-teams.create` (body `registerTeamSchema`)
- `DELETE /:leagueTeamId` `league-teams.delete`
- `GET /:leagueTeamId/members` `league-roster.view`
- `GET /:leagueTeamId/members/candidates` `league-roster.view` (register before any `/:memberId` route)
- `POST /:leagueTeamId/members` `league-roster.create` (body `addMembersSchema`)
- `DELETE /:leagueTeamId/members/:memberId` `league-roster.delete`

Also add `GET /admin/leagues/:leagueId/eligible-teams` (permission `league-teams.create`) to `leagues.admin.routes.ts`, handled by `league-teams.admin.controller.ts` → `listEligibleTeams` with the admin actor. Define it before `/:leagueId` is irrelevant (different depth), but keep it grouped above `PUT`.

Docs (`league-teams.admin.docs.ts`): tag "Admin - League Teams"; document every path and the `ineligibleReason` enum.

### Task 8 — Public + authenticated app endpoints
Folder `competition/leagues/`.

`leagues.service.ts`:
- `listPublicLeagues(query, actor)`: `where.status = query.status ?? { not: "INACTIVE" }`, plus season/category/search filters; order `[{ status asc? no }]` → use `orderBy: { id: "desc" }`; items `toLeagueResponse` + `can` (`leaguePolicy`).
- `getPublicLeague(leagueId, actor)`: 404 for INACTIVE; `toLeagueResponse` + `can`.
- `listMyLeagues(userId, query, actor)`: DB-based (see 5.11).
  1. Manager rows: `LeagueTeam` ACTIVE where `team.organizationId in actor.managedOrgIds`, `team.status != DELETED`, league `status != INACTIVE` (skip query when the set is empty).
  2. Member rows: `LeagueTeamMember` ACTIVE where `teamSeasonMember.userId = userId` and `teamSeasonMember.status = ACTIVE`, `leagueTeam.status = ACTIVE`, league `status != INACTIVE`.
  3. Merge by `leagueTeamId`, collecting `roles` ⊆ `["MANAGER","COACH","PLAYER"]` (role from `teamSeasonMember.role`), group by league, sort by league id desc, paginate in memory.
  4. Item: `{ league: <league summary>, myTeams: [{ leagueTeamId, team: { id, name, logoUrl }, organization: { id, name }, roles, can: LeagueTeamCan }] }`. A coach/player-only user gets only the team(s) they belong to; a manager gets the registered teams of the organizations they manage.

Controller: one function per endpoint; pass `req.actor!`.

Routes (`leagues.routes.ts`) — order matters:
```
GET    /me                                                    verifyJWT, attachActor, validate(myLeaguesQuerySchema,"query")      (BEFORE /:leagueId)
GET    /                                                      optionalJWT, optionalActor, validate(publicLeagueListQuerySchema,"query")
GET    /:leagueId                                             optionalJWT, optionalActor, validate(leagueIdParamSchema,"params")
GET    /:leagueId/teams                                       optionalJWT, optionalActor, params + leagueTeamsQuerySchema
GET    /:leagueId/teams/:leagueTeamId/members                 optionalJWT, optionalActor, params + membersQuerySchema   (public roster)
GET    /:leagueId/eligible-teams                              verifyJWT, attachActor, params + eligibleTeamsQuerySchema
POST   /:leagueId/teams                                       verifyJWT, attachActor, params + registerTeamSchema
DELETE /:leagueId/teams/:leagueTeamId                         verifyJWT, attachActor, leagueTeamParamSchema
GET    /:leagueId/teams/:leagueTeamId/members/candidates      verifyJWT, attachActor, params + candidatesQuerySchema
POST   /:leagueId/teams/:leagueTeamId/members                 verifyJWT, attachActor, params + addMembersSchema
DELETE /:leagueId/teams/:leagueTeamId/members/:memberId       verifyJWT, attachActor, leagueMemberParamSchema
```
Notes:
- `optionalJWT` / `optionalActor` come from `middleware/auth/optionalJWT.middleware.ts` and `attachActor.middleware.ts` (`optionalActor` named export). They never fail for guests; logged-in callers additionally get `can` flags.
- Public member responses use `toPublicMemberItem` for everyone (including managers). Candidates for the app use the non-admin variant (no phone/birthDate).
- Public members response: `{ league: { id, name, status }, leagueTeam: { id, team: { id, name } }, items, total, page, pageSize, can }` (`can` = `LeagueTeamCan`, all false for guests).

Docs (`leagues.docs.ts`): tag "Leagues"; public endpoints `security: []` with a description noting that a Bearer token adds `can` flags; authenticated endpoints keep `security: [{ bearerAuth: [] }]`. Register `LeagueCan`, `LeagueTeamCan`, `LeagueTeamItem`, `LeagueMember`, `LeagueCandidate`, `MyLeague` schemas.

### Task 9 — Static league statuses endpoint
`src/modules/shared/league-statuses/` mirroring `coach-degrees`: service maps `Object.values(LeagueStatus)` (import from generated enums) to `{ value, label }` with labels `INACTIVE: "غیرفعال"`, `REGISTRATION: "در حال ثبت‌نام"`, `ACTIVE: "در جریان"`, `FINISHED: "تمام‌شده"`. Public `GET /league-statuses` returning `{ statuses }`. Docs file with tag "League Statuses".

### Task 10 — Route + Swagger wiring
`src/routes/index.ts` — add (order matters; the nested admin router first):
```
router.use("/league-statuses", leagueStatusesRoutes);
router.use("/leagues", leaguesRoutes);
router.use("/admin/leagues/:leagueId/teams", leagueTeamsAdminRoutes);
router.use("/admin/leagues", leaguesAdminRoutes);
```
`src/swagger/swagger.ts` — import the four new `*.docs.ts` files (`leagues.docs.ts`, `leagues.admin.docs.ts`, `league-teams.admin.docs.ts`, `league-statuses.docs.ts`).

### Task 11 — Cutoff lock (age-categories module)
In `src/modules/age-categories/admin/age-category-cutoffs/age-category-cutoffs.admin.service.ts` implement `assertCutoffEditable(cutoffId)`:
```
const used = await prisma.league.count({ where: { ageCategoryCutoffId: cutoffId } });
if (used > 0) throw new AppError(409, messages.error.ageCategoryCutoff.inUse);
```
Remove the TODO comment block. Callers already invoke it (update after the no-op short-circuit, and delete). Keep the existing `P2003` mappings. Update the cutoffs Swagger 409 description if needed.

### Task 12 — Team module guards (teams module)
In `src/modules/teams/teams.service.ts`:
- Add internal helper `isLockedByLeague(memberId)`: exists `LeagueTeamMember` with `status ACTIVE`, `teamSeasonMemberId = memberId`, `leagueTeam.status ACTIVE`, `leagueTeam.league.status in [ACTIVE, FINISHED]`.
- `removeRosterMember`: after the permission checks, if locked → 409 `team.memberInActiveLeague`. Otherwise run the existing update **and** `leagueTeamMember.updateMany({ where: { teamSeasonMemberId: memberId, status: "ACTIVE" }, data: { status: "DELETED" } })` in one `$transaction` (keeps rosters of INACTIVE/REGISTRATION leagues consistent).
- `updateRosterMember`: if the update changes `role` or `jerseyNumber` and the member is locked → 409 `team.memberInActiveLeague`. If `role` changes and not locked → also soft-delete the member's ACTIVE league roster rows in the same transaction (the selection is no longer valid). Changing only `isHeadCoach` is unaffected.
- No change to `addRosterMember`, routes, validation, or docs structure. Add the new 409 to the roster remove/update docs descriptions in `teams.docs.ts` and `teams.admin.docs.ts` only if trivial.

### Task 13 — Documentation updates
- `docs/modules/competition.md`: replace "Not Started" with Purpose / Entities (`League`, `LeagueTeam`, `LeagueTeamMember`) / Sub-modules (`leagues`, `admin/leagues`, `admin/league-teams`) / Responsibilities (rules from section 5) / Relationships (→ age-categories cutoff lock, → seasons via cutoff, → teams via `TeamSeasonMember` selection and guards, → organizations via `managedOrgIds`; planned → games/groups/series).
- `docs/04-data-model.md`: add the three models and key decisions (season/category derived from cutoff; league roster is a selection of `TeamSeasonMember`; statuses; soft-delete on league team/member).
- `docs/modules/age-categories.md`: cutoff lock is now live (remove the "no-op stub" and TODO(League) wording).
- `docs/modules/teams.md`: add the league guards and cascade.
- `docs/modules/shared.md`: add `league-statuses`.
- `docs/status/current-state.md`: add leagues / league-teams / league-roster rows as done; `docs/status/roadmap.md`: Competition now "groups, series, games next"; expand the Permissions line with the new groups.
- `docs/03-project-structure.md`: update the `competition/` line. `docs/05-middleware.md` and `docs/09-authorization.md`: note `optionalJWT` + `optionalActor` are now used by public league routes.
- `docs/08-conventions.md`: hard delete for leagues (guarded), soft delete for league teams/members.

---

## 7. API surface

### 7.1 Admin (`verifyJWT` + `verifyAdminLevel(ADMIN, SUPER_ADMIN)` + `verifyPermission`)

| Method & path | Permission | Purpose |
|---|---|---|
| `GET /admin/leagues` | `leagues.view` | Paginated list; filters `status`, `seasonId`, `ageCategoryId`, `search`; includes season, age category, `teamsCount` |
| `GET /admin/leagues/:leagueId` | `leagues.view` | League detail |
| `POST /admin/leagues` | `leagues.create` | Create (status `INACTIVE`) |
| `PUT /admin/leagues/:leagueId` | `leagues.update` | Edit (rules 5.3) |
| `PATCH /admin/leagues/:leagueId/status` | `leagues.update` | Change status (rules 5.2) |
| `DELETE /admin/leagues/:leagueId` | `leagues.delete` | Delete (rules 5.4) |
| `GET /admin/leagues/:leagueId/eligible-teams` | `league-teams.create` | Teams that can be registered (ACTIVE, with season roster); `search`, `organizationId` |
| `GET /admin/leagues/:leagueId/teams` | `league-teams.view` | Registered teams with members count |
| `POST /admin/leagues/:leagueId/teams` | `league-teams.create` | Register any eligible team (admin) |
| `DELETE /admin/leagues/:leagueId/teams/:leagueTeamId` | `league-teams.delete` | Withdraw team (soft; clears its roster) |
| `GET /admin/leagues/:leagueId/teams/:leagueTeamId/members` | `league-roster.view` | League roster (admin fields incl. phone, birth date) |
| `GET .../members/candidates` | `league-roster.view` | Team season roster with `selected` / `eligible` / `ineligibleReason` |
| `POST .../members` | `league-roster.create` | Add one or many (`teamSeasonMemberIds[]`), age-checked |
| `DELETE .../members/:memberId` | `league-roster.delete` | Remove member (soft) |

### 7.2 App — public (no JWT required; optional Bearer adds `can`)

| Method & path | Purpose |
|---|---|
| `GET /league-statuses` | Static status values with Persian labels |
| `GET /leagues` | Public list; `status` filter (`REGISTRATION`/`ACTIVE`/`FINISHED`), `seasonId`, `ageCategoryId`, `search`; never `INACTIVE` |
| `GET /leagues/:leagueId` | League detail (season, category, status, deadline, teams count) |
| `GET /leagues/:leagueId/teams` | Registered teams (name, logo, organization, members count) |
| `GET /leagues/:leagueId/teams/:leagueTeamId/members` | Public roster (safe fields only) |

### 7.3 App — authenticated

| Method & path | Purpose |
|---|---|
| `GET /leagues/me` | "My leagues" for the profile: leagues where the user manages a registered team or is in a league roster; coach/player see only their team; each team carries `roles` and `can` |
| `GET /leagues/:leagueId/eligible-teams` | Manager's own teams that can register (ACTIVE, in managed org, has season roster); `alreadyRegistered` flag |
| `POST /leagues/:leagueId/teams` | Register a team (manager) |
| `DELETE /leagues/:leagueId/teams/:leagueTeamId` | Withdraw (manager, registration window) |
| `GET .../members/candidates` | Team season roster with eligibility flags (manager) |
| `POST .../members` / `DELETE .../members/:memberId` | Edit league roster (manager, `REGISTRATION` + before `rosterDeadline`) |

### 7.4 Response notes
- League item: `{ id, name, description, status, startDate, endDate, rosterDeadline, ageCategoryCutoffId, ageCategory{id,name}, season{id,name}, minBirthDate, teamsCount, createdAt, updatedAt, can? }` (dates Jalali).
- Public member item fields: `id, teamSeasonMemberId, userId, fullName, avatarUrl, role, jerseyNumber, isHeadCoach`.
- App candidates: public member fields + `selected, eligible, ineligibleReason`. Admin candidates/members add `phone` and `birthDate`.

---

## 8. Verification checklist (manual, via Swagger `/docs` or HTTP client)

1. `npx tsc --noEmit` clean; server starts; `/docs` shows tags "Leagues", "Admin - Leagues", "Admin - League Teams", "League Statuses".
2. Setup data: season, age category, cutoff for that season; org with a manager; team with season roster (>= 2 players with `birthDate`, 1 coach).
3. Admin creates league → status `INACTIVE`, not visible in `GET /leagues`; duplicate name under same cutoff → 409; second league (different name) under same cutoff works.
4. Admin sets `REGISTRATION` → appears publicly with `status=REGISTRATION` filter; public teams list is empty.
5. Manager: `eligible-teams` shows only own ACTIVE teams with a season roster; registering a team without season roster → 400; a team of another organization → 403; registering twice → 409.
6. Roster: candidates show `eligible=false` for players too old / missing birth date; adding them → 400 (`ageIneligible` / `birthDateRequired`); adding an eligible player works; the same player in a second team of the league → 409; removing and re-adding reactivates.
7. Past `rosterDeadline` → manager gets 409 `rosterClosed`; admin still can edit in `REGISTRATION`/`ACTIVE`.
8. Public roster endpoint (no token) returns safe fields only (no phone/email/birth date).
9. `GET /leagues/me`: as manager (own teams), as player/coach (only own team), as unrelated user (empty).
10. Status → `ACTIVE` fails with < 2 teams or a team without players; succeeds otherwise. `FINISHED` → other status needs SUPER_ADMIN.
11. Cutoff lock: updating/deleting a cutoff that has a league → 409; changing the league's cutoff after a team registered → 409.
12. Team module: removing a roster member who is in an `ACTIVE` league roster → 409; removing one in a `REGISTRATION` league roster succeeds and soft-deletes the league roster row; role change clears league selection.
13. Delete league: blocked with ACTIVE teams (409), blocked in `ACTIVE`/`FINISHED`; allowed in `INACTIVE` with no teams (and with only DELETED teams).
14. Admin without `leagues.*` permission gets 403 `Missing permission: ...`; SUPER_ADMIN passes.

---

## 9. Edge cases the agent must not miss
- Route order: `/me` before `/:leagueId`; nested admin router mounted before `/admin/leagues`; `/members/candidates` before any `/members/:memberId`.
- `optionalJWT` swallows invalid tokens → guest. Public handlers must still run when `req.actor` is the guest actor.
- Never trust client `status` on create/update; never accept `leagueId` in bodies when it is in the path.
- Compare dates as `Date.getTime()` (both are UTC-noon) — never as Jalali strings.
- A re-registered team starts with an empty roster (its old members stayed `DELETED`).
- `LeagueTeam` items must be hidden when `team.status = DELETED` even if the `LeagueTeam` row is ACTIVE.
- Hard-delete of a league must clear DELETED `LeagueTeam`/`LeagueTeamMember` rows first (FK RESTRICT).

---

## 10. Out of scope now / hooks left for later
- Groups, `Game`, `Series` (`best_of`, `next_series_id`), referees assignment, `player_game_stats`, standings (computed from game results, never stored). All will reference `LeagueTeam` (not `Team`) and stats will reference `LeagueTeamMember`.
- `assertNoGames(leagueId)` stub in the status service; `isLockedByLeague` already covers ACTIVE/FINISHED leagues for the roster guards.
- Public sub-resources to add later under `/leagues/:leagueId/...`: `groups`, `games`, `bracket`, `standings`.
- Possible later: `dropdowns/leagues`, head-coach (not only org manager) managing league rosters, minimum roster size per league config, age-rule override by admin.