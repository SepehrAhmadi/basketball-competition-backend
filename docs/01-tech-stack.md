# Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Runtime | Node.js + TypeScript (ESM) | `"type": "module"`, internal imports use explicit `.ts` suffix |
| Framework | Express 5.2.1 | Router mounted at `/api/v1` in `src/routes/index.ts` |
| ORM | Prisma 7.9.1 + `@prisma/adapter-mariadb` | Client created with MariaDB driver adapter in `src/config/db.config.ts` |
| Database | MySQL / MariaDB | Connection URL built in `prisma.config.ts`; schema in `src/prisma/schema.prisma` |
| Validation | Zod 3.25.76 | Per-module `*.validation.ts` schemas, run via `validate` middleware |
| API docs | `@asteasolutions/zod-to-openapi` + `swagger-ui-express` | Served at `/docs` (non-production) from `src/swagger/swagger.ts` |
| Uploads | multer 2.3.0 | Per-route instances via `createUploader` factory |
| Auth | `jsonwebtoken` + `bcrypt` | 15-min access token, 1-day refresh token persisted on `User` |
| Dates | `moment-jalaali` | Jalali `YYYY/MM/DD` input ↔ Gregorian `Date` storage |
| Env | `dotenv` | Loaded first in `src/server.ts` via `dotenv/config` |
| Dev runner | `tsx watch src/server.ts` | No build step; `tsconfig` `module ESNext`, `allowImportingTsExtensions` |

A separate Nuxt/Vue frontend consumes this API and is out of scope for these docs.

Notes:
- `src/server.ts` imports `swagger/zod-extend.ts` before `dotenv/config` so `.openapi()` is available everywhere.
- Prisma generator uses `moduleFormat = "esm"` to match the ESM runtime.
