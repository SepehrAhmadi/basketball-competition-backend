# Project Structure

```
src/
├── app.ts                  # middleware order, static, /docs, /api/v1, errorHandler last
├── server.ts               # dotenv + zod-extend preload, listen
├── config/                 # db, cors, origins, upload limits
├── routes/index.ts         # mounts all module routers under /api/v1
├── middleware/             # see 05-middleware.md
├── utils/                  # see 06-utilities.md
├── shared/                 # PERMISSION_CATALOG + id/pagination schemas
├── types/express/          # Request augmentation (userId, roles, validated*)
├── language/message.ts     # central Persian messages
├── swagger/                # registry, helpers, zod-extend, doc aggregation
├── prisma/schema.prisma    # 12 models, enums (see 04-data-model.md)
└── modules/
    ├── competition/        # empty placeholder (see modules/competition.md)
    ├── organizations/      # org CRUD + logos + managers
    ├── people/auth|user|admin-users|players|coaches|referees/
    ├── seasons/            # season lifecycle
    ├── shared/roles|coach-degrees|referee-levels/
    └── teams/              # team CRUD + roster
```

- `src/` — all runtime code; `rootDir: ./src`, ESM with `.ts` import suffixes.
- `src/config/` — DB adapter, CORS, upload limits.
- `src/middleware/` — cross-cutting request handlers; details in `05-middleware.md`.
- `src/utils/` + `src/shared/` — plain helpers; details in `06-utilities.md`.
- `src/modules/` — domain folders; details in `modules/*.md`.
- `src/swagger/` — OpenAPI registry + per-module `*.docs.ts` aggregation.
- `src/prisma/` — schema, migrations, seed (super-admins only).
- Layering rationale lives in `02-architecture.md`.
