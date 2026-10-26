# Project Structure

```
src/
├── app.ts                  # middleware order, static, /docs, /api/v1, errorHandler last
├── server.ts               # dotenv + zod-extend preload, listen
├── config/                 # db, cors, origins, upload limits
├── routes/index.ts         # mounts all module routers under /api/v1
├── middleware/             # see 05-middleware.md (auth/*, validate, errorHandler, upload/*)
├── authz/                  # Actor loader types + assertAllowed (see 09-authorization.md)
├── utils/                  # see 06-utilities.md
├── shared/                 # PERMISSION_CATALOG + id/pagination schemas + Advisory
├── types/express/          # Request augmentation (userId, roles, adminLevel, permissions, actor, validated*)
├── language/message.ts     # central Persian messages
├── swagger/                # registry, helpers, zod-extend, doc aggregation
├── prisma/schema.prisma    # 17 models, enums (see 04-data-model.md)
└── modules/
    ├── age-categories/admin/age-categories|age-category-cutoffs/  # admin-only category + cutoff CRUD
    ├── competition/         # competition structure (see modules/competition.md)
    │   └── format/          # league format settings on League (admin/ + lib/)
    ├── leagues/              # league CRUD, registration, roster (see modules/leagues.md)
    │   ├── services/         # 3+ services live here (leagues, league-teams, league-roster)
    │   ├── lib/              # module-private logic (rules, access, mapper, lifecycle)
    │   └── admin/            # nested admin folders: league/ and league-team/
    ├── organizations/      # org CRUD + logos + managers + admin/ (restore, status filter)
    ├── people/auth|user (with user/admin)|players|coaches|referees/
    ├── seasons/            # season lifecycle
    ├── shared/dropdowns/    # dynamic lookups (JWT) + static/ public enum lookups under /dropdown/[name]
    └── teams/              # team CRUD + roster + admin/ (restore, roster manage)
```

- `src/` — all runtime code; `rootDir: ./src`, ESM with `.ts` import suffixes.
- `src/config/` — DB adapter, CORS, upload limits.
- `src/middleware/` — cross-cutting request handlers; details in `05-middleware.md`.
- `src/utils/` + `src/shared/` — plain helpers; details in `06-utilities.md` (`shared/advisory.ts` holds the `Advisory` contract).
- `src/modules/` — domain folders; details in `modules/*.md`.
- `src/swagger/` — OpenAPI registry + per-module `*.docs.ts` aggregation.
- `src/prisma/` — schema, migrations, seed (super-admins only).
- Layering rationale lives in `02-architecture.md`.
