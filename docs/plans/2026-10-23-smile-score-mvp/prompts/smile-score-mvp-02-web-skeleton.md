---
type: prompt
plan: "[[2026-10-23-smile-score-mvp]]"
id: 02
unit:
status: done
model: sonnet
effort: medium
depends_on: [01]
parallel_group:
files:
  create: ["apps/web/** (create-next-app + shadcn init output)", apps/web/.env.example, apps/web/.prettierrc, apps/web/vitest.config.ts, apps/web/drizzle.config.ts, apps/web/src/lib/db/index.ts, apps/web/src/lib/db/schema.ts, apps/web/src/app/api/health/route.ts]
  modify: [apps/web/package.json, apps/web/.gitignore, apps/web/src/app/page.tsx, apps/web/eslint.config.mjs]
  delete: []
---
# 02 · Web skeleton: Next.js 16, shadcn/ui, Drizzle client, DB health route

## Task
Scaffold `apps/web` with create-next-app and shadcn/ui, add the tooling scripts, a node-postgres Drizzle client and
`GET /api/health`, which runs `select 1`. This is Phase 0: just enough to deploy to Vercel and prove that it reaches
Neon.

## Context
- Repo root: `/home/apa/Code/smile-score-app`. Prompt 01 has already created the root `.gitignore` and
  `docker-compose.yml` (service `db`: postgres:16, user/password `postgres`, db `smile`, port 5432). Spec: PLAN.md §3, §4, §8, §9. The decided web stack is Next.js 16
  (App Router, TS), pnpm, Drizzle ORM + drizzle-kit, `pg`, zod, Tailwind + shadcn/ui, Vitest, ESLint + Prettier.
  Don't add anything else in this prompt.
- **VERIFY the flags** with `pnpm create next-app@latest --help`, then run it non-interactively from the repo root:
  `pnpm create next-app@latest apps/web --ts --app --tailwind --eslint --src-dir --import-alias "@/*" --use-pnpm`
  (accept the defaults for the rest). Then, in `apps/web`, run `pnpm dlx shadcn@latest init` (defaults, neutral
  base). Don't add any components yet.
- If pnpm prints **"Ignored build scripts"**, approve only the packages it names, using `pnpm approve-builds` or
  `pnpm.onlyBuiltDependencies` in package.json, and say which ones you approved.
- Dependencies: `pnpm add drizzle-orm pg zod`, then `pnpm add -D drizzle-kit @types/pg vitest prettier eslint-config-prettier`.
- `package.json`:
  - `"engines": { "node": ">=24" }`
  - Scripts: keep `dev`, `build`, `start`, `lint` from the scaffold, and add `"typecheck": "tsc --noEmit"`,
    `"test": "vitest run --passWithNoTests"`, `"format": "prettier --write ."`, `"db:generate": "drizzle-kit generate"`
    and `"db:migrate": "drizzle-kit migrate"`.
- Add `eslint-config-prettier` as the last entry in the flat `eslint.config.mjs`.
- `.prettierrc`: `{ "semi": true, "singleQuote": false, "trailingComma": "all", "printWidth": 100 }`.
- `vitest.config.ts`: `environment: "node"`, `include: ["tests/**/*.test.ts"]`, and
  `resolve.alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }`. No `vite-tsconfig-paths` dependency.
- `apps/web/.gitignore` (generated): it contains `.env*`, which would hide `.env.example`, so add `!.env.example`.
  Add `.data/` too.
- `.env.example`, exactly PLAN §8:
  ```
  DATABASE_URL=postgres://postgres:postgres@localhost:5432/smile   # prod: Neon pooled URL with sslmode=require
  BETTER_AUTH_SECRET=                                              # openssl rand -base64 32
  BETTER_AUTH_URL=http://localhost:3000                            # prod: Vercel URL
  SCORER_URL=http://localhost:8000                                 # prod: Render URL
  SCORER_API_KEY=dev-scorer-key                                    # must match the scorer
  BLOB_READ_WRITE_TOKEN=                                           # prod only; leave empty for local disk
  ```
- `src/lib/db/schema.ts`: just a header comment (Better Auth tables arrive in prompt 07, and `uploads` in 11) and
  `export {};`.
- `src/lib/db/index.ts`:
  ```ts
  import { drizzle } from "drizzle-orm/node-postgres";
  import { Pool } from "pg";
  import * as schema from "./schema";
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  export const db = drizzle(pool, { schema });
  ```
  Comment: the same driver serves local Docker Postgres and Neon's pooled URL (DECISIONS #8).
- `drizzle.config.ts`: `import { existsSync } from "node:fs"`. If `existsSync(".env.local")`, call
  `process.loadEnvFile(".env.local")` (drizzle-kit doesn't load it, and this needs no dotenv dependency). Then
  `defineConfig({ dialect: "postgresql", schema: "./src/lib/db/schema.ts", out: "./drizzle", dbCredentials: { url: process.env.DATABASE_URL! } })`.
- `src/app/api/health/route.ts`:
  `export async function GET()`. In a try block, run `await db.execute(sql\`select 1\`)`, then return
  `Response.json({ status: "ok" })`. In the catch, return `Response.json({ status: "error" }, { status: 503 })`,
  and `console.error` the error without echoing the connection string.
- `src/app/page.tsx`: replace the scaffold's marketing page with a minimal centered "Smile Score" heading. Prompt 09
  turns it into a redirect.

## Do not
- Touch files outside `apps/web/`. If you must, stop and report why.
- Add components, auth or upload code (later prompts handle those).
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app && docker compose up -d db
cd apps/web && cp -n .env.example .env.local
pnpm lint && pnpm typecheck && pnpm test && pnpm build
(pnpm start & sleep 4; curl -sf localhost:3000/api/health; kill %1)   # {"status":"ok"}
git -C /home/apa/Code/smile-score-app check-ignore -q apps/web/.env.example && echo "EXAMPLE IGNORED: fix" || echo ok
```
