# Plan: Advisory System (Backend) and Migration of Existing Reason Codes

## 1. Goal

Introduce one shared, structured shape for "reasons and warnings" returned by the API, and migrate every place that currently returns a raw reason code to it.

Today the frontend hardcodes Persian text for raw codes (`OWN_ROW`, `TOO_OLD`, `FINISHED`, ...). After this plan the backend sends the code, a severity, a ready-to-display Persian message, and params.

**Out of scope:** groups (Stage 2). It resumes after this plan is done and will use the advisory system from day one.

**Compatibility decision:** the raw fields are **replaced**, not kept alongside. This is a breaking change; backend and frontend (admin panel + PWA) ship together.

---

## 2. Contract

```ts
type AdvisorySeverity = "INFO" | "WARNING" | "BLOCKER";

interface Advisory<C extends string = string> {
  code: C;                       // stable, for frontend logic (icon, color, filtering)
  severity: AdvisorySeverity;
  message: string;               // Persian, from message.ts, ready to display
  params: Record<string, string | number | boolean | null>;
}
```

Severity meaning:

| Severity | Meaning |
|---|---|
| `INFO` | Informational, nothing is wrong |
| `WARNING` | Allowed and saved, but incomplete or suspicious |
| `BLOCKER` | Prevents an action the user is looking at (edit, toggle, add) |

Field naming rules (applies to every endpoint from now on):

- A list of general warnings is always named **`issues: Advisory[]`**; when empty it is `[]`, never `null` and never omitted.
- A single reason attached to one concern is a **nullable `Advisory`** named after the concern (`lock`, `toggleLock`, `ineligibility`); `null` means "no reason".
- `can` flags stay as they are. They answer "may I?"; advisories answer "why not / what is wrong?".

Principles:

1. An advisory is **output data**, not middleware, an event, or a stored record. No tables.
2. Real enforcement stays in services via `AppError` (403/409). Rules stay pure and return **internal codes**; the advisory is built at the response boundary (mapper). The same pure rule can later both warn and block (the same code feeds `AppError` and `Advisory`).
3. Each module owns its code union; the shared file stays generic.
4. All message text lives in `src/language/message.ts` (project convention). Where an advisory has the same meaning as an existing error message, **reuse the same Persian text** instead of writing a second one.

---

## 3. Stage A: Foundation

### A1. `src/shared/advisory.ts` (new)

- Types `AdvisorySeverity`, `Advisory<C>`.
- Helper `makeAdvisory(code, severity, message, params = {})` returning an `Advisory`.
- Helper `noIssues: Advisory[]` is **not** shared (avoid shared mutable arrays); callers return a fresh `[]`.
- No Prisma, no `AppError`, no Express imports (pure, unit-testable).

### A2. `src/language/message.ts`

Add a new top-level section `advisory` (the rest of the file is untouched). It may contain functions because the file is `as const`:

```ts
advisory: {
  format: {
    finished: messages-equivalent text,
    hasGames: ...,
  },
  leagueRoster: {
    ownRow: ...,
    managerOnly: ...,
    birthDateMissing: ...,
    tooOld: ...,
    inOtherTeam: ...,
  },
}
```

Rules:

- Static strings reuse the exact Persian text of the matching error where one exists (`league.finishedLocked`, `leagueFormat.locked`, `leagueRoster.ownRowLocked`, `leagueRoster.headCoachRowManagerOnly`, `leagueRoster.birthDateRequired`, `leagueRoster.ageIneligible`, `leagueRoster.playerInOtherTeam`). To avoid duplicated strings, the advisory entry should reference the error entry (`advisory.x: error.y`) or the error should be the single definition.
- Parameterized texts use function templates, e.g. `(name: string, min: number) => ...`. None are needed for the migration below; the mechanism exists for Stage 2.

### A3. Swagger

In `src/swagger/helpers.ts` (or a new `src/swagger/advisory.docs.ts`):

- `advisorySchema` registered as `"Advisory"` with `code`, `severity` (enum), `message`, `params`.
- Helper `advisoryCodeSchema(codes)` or per-module enums so each endpoint documents its possible codes.
- Short note in `*.docs.ts` descriptions: "`issues` is always present; empty array means no issues."

### A4. Tests (`tsx --test`)

- `src/shared/advisory.test.ts`: `makeAdvisory` shape, default `params`.
- Per-module builder tests (see stages B and C): every code maps to the expected severity and message, and unknown inputs are not possible by type.

---

## 4. Stage B: Migrate league format lock

**Current:** `GET/PUT /admin/leagues/:leagueId/format` returns `lockReason: "FINISHED" | "HAS_GAMES" | null`.

| File | Change |
|---|---|
| `competition/format/lib/format.rules.ts` | Keep `FormatLockReason` as the **internal** code type |
| `competition/format/lib/format.advisories.ts` (new) | `buildFormatLock(reason): Advisory<FormatLockReason> \| null` (`FINISHED` and `HAS_GAMES` are both `BLOCKER`) |
| `competition/format/admin/format.admin.service.ts` | `getLockReason` unchanged; `toFormatResponse` returns `lock: buildFormatLock(...)` instead of `lockReason` |
| `competition/format/admin/format.admin.docs.ts` | Replace `lockReason` schema with `lock: advisorySchema.nullable()`; document codes |
| `docs/modules/competition.md`, `docs/modules/competition-structure.md` | Replace `lockReason` wording with `lock` advisory |

Response field change:

```diff
- "lockReason": "FINISHED"
+ "lock": { "code": "FINISHED", "severity": "BLOCKER", "message": "...", "params": {} }
```

The 409 error on `PUT` (`league.finishedLocked`) is unchanged.

---

## 5. Stage C: Migrate league roster reasons

Two raw reason fields live on roster candidates (`GET .../members/candidates`, public app and admin variants):

- `toggleLockReason: "OWN_ROW" | "MANAGER_ONLY" | null`
- `ineligibleReason: "BIRTH_DATE_MISSING" | "TOO_OLD" | "IN_OTHER_TEAM" | null`

### C1. Code and severity mapping

| Old field | Code | Severity | Message source |
|---|---|---|---|
| `toggleLockReason` | `OWN_ROW` | `BLOCKER` | `leagueRoster.ownRowLocked` |
| `toggleLockReason` | `MANAGER_ONLY` | `BLOCKER` | `leagueRoster.headCoachRowManagerOnly` |
| `ineligibleReason` | `BIRTH_DATE_MISSING` | `BLOCKER` | `leagueRoster.birthDateRequired` |
| `ineligibleReason` | `TOO_OLD` | `BLOCKER` | `leagueRoster.ageIneligible` |
| `ineligibleReason` | `IN_OTHER_TEAM` | `BLOCKER` | `leagueRoster.playerInOtherTeam` |

### C2. New response fields (replacing the old ones)

| Old | New |
|---|---|
| `toggleLockReason` | `toggleLock: Advisory \| null` |
| `ineligibleReason` | `ineligibility: Advisory \| null` |

`canToggle`, `eligible`, `selected` stay unchanged (the frontend keeps using booleans for logic and shows the advisory text as the reason).

### C3. File changes

| File | Change |
|---|---|
| `leagues/lib/league.advisories.ts` (new) | `buildToggleLock(reason: LockReason)` and `buildIneligibility(reason)`; both return `Advisory \| null` |
| `leagues/leagues.policy.ts` | **No change** to `RosterRowDecision` / `LockReason` (pure policy keeps returning codes). `lockReasonMessage` stays for 403 errors |
| `leagues/lib/league.rules.ts` | **No change** (`isPlayerAgeEligible` keeps returning codes) |
| `leagues/lib/league.candidates.ts` | `mapCandidate` passes codes to builders; the string `"IN_OTHER_TEAM"` becomes a typed code; `CandidateExtras` carries advisories |
| `leagues/lib/league.mapper.ts` | `CandidateExtras` and `toCandidateItem` output `toggleLock` and `ineligibility`; drop `toggleLockReason` / `ineligibleReason` |
| `leagues/leagues.docs.ts` | `leagueCandidateSchema`: replace the two fields with advisory schemas and list the codes |
| `leagues/admin/league-team/league-teams.admin.docs.ts` | Inherits via `.extend`; verify the generated `AdminLeagueCandidate` schema |
| `docs/modules/leagues.md` | Update the candidates bullet (`toggleLockReason` → `toggleLock`, etc.) |
| `docs/09-authorization.md` | Note that `can` flags are paired with advisory reasons |

Error paths that must not change: `loadAddableRows` (403 via `lockReasonMessage`), `assertPlayersEligible` (400/409), `throwDenial`. Advisory text and error text must stay identical by sharing the message source (see A2).

---

## 6. Stage D: Audit for any other raw reason codes

Before closing the work, grep for other raw reason-style fields and classify each:

- `grep -rn "Reason" src/modules` (e.g. `lockReason`, `ineligibleReason`, `toggleLockReason`, `LockReason`, `Denial`).
- `Denial` in `leagues.policy.ts` is an **internal** code mapped to `AppError`; it is not exposed in a response and stays as is.
- Anything exposed in a JSON response as a bare code string joins this migration; anything internal stays.

Expected result: only the three fields above are exposed raw codes, so no further migration is needed.

---

## 7. Stage E: Conventions and documentation

- `docs/08-conventions.md`: add an "Advisories" section: contract, severity meaning, `issues` naming, "rules return codes, mappers build advisories", "reuse error message text".
- `docs/06-utilities.md`: add rows for `Advisory` / `makeAdvisory` (`src/shared/advisory.ts`).
- `docs/03-project-structure.md`: mention `shared/advisory.ts`.
- `docs/status/current-state.md`: add a "Known Issues Fixed" line for the advisory migration.
- Update Swagger descriptions on every migrated endpoint.

---

## 8. Breaking-change rollout

All changes are in one backend release, coordinated with admin panel and PWA releases.

| Endpoint(s) | Frontend change |
|---|---|
| `GET/PUT /admin/leagues/:leagueId/format` | Read `lock.message` / `lock.code` instead of mapping `lockReason` |
| `GET /leagues/:leagueId/teams/:leagueTeamId/members/candidates` | `toggleLockReason` → `toggleLock`; `ineligibleReason` → `ineligibility`; display `.message` directly |
| `GET /admin/leagues/:leagueId/teams/:leagueTeamId/members/candidates` | Same as above |

Frontend work: build one shared component that renders an `Advisory` (color/icon by `severity`, text from `message`), and remove all hardcoded reason-text maps.

---

## 9. Implementation order

1. A1 → A2 → A3 → A4 (foundation, no behavior change).
2. Stage B (format) with tests.
3. Stage C (roster candidates) with tests.
4. Stage D audit.
5. Stage E docs.
6. Smoke test through Swagger: format `GET/PUT` for a `FINISHED` league; candidates for manager, head coach, regular coach, and player roles (each lock and ineligibility code).

Each step is independently mergeable except the frontend-visible breaking changes in B and C, which should be released together.

---

## 10. Acceptance checklist

- [ ] `src/shared/advisory.ts` exists with types, `makeAdvisory`, and tests.
- [ ] `message.ts` has an `advisory` section; no advisory text is written inline in code; no duplicate Persian strings.
- [ ] No response exposes `lockReason`, `toggleLockReason`, or `ineligibleReason`.
- [ ] Every migrated field is `Advisory | null`; every list-level warning field would be named `issues` and never `null`.
- [ ] 403/409/400 errors behave exactly as before (same messages and status codes).
- [ ] Swagger documents `Advisory` and all codes per endpoint.
- [ ] Docs updated; groups work (Stage 2) is unblocked and uses `issues: Advisory[]`.

---

## 11. Open points to confirm before coding

1. **Field names:** `lock`, `toggleLock`, `ineligibility` (proposed above). Change now if you prefer other names, since they are breaking.
2. **Severity of row locks:** all roster reasons are `BLOCKER` in this plan; `INFO` is kept for non-blocking notices introduced later.
3. **Where builders live:** per-module `lib/*.advisories.ts` (proposed) versus one central file. Per-module keeps codes owned by their module and respects the one-directional dependency rule.