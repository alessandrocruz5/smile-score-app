---
type: prompt
plan: "[[2026-10-23-smile-score-mvp]]"
id: 07
unit:
status: todo
model: opus
effort: high
depends_on: [02]
parallel_group:
files:
  create: [apps/web/src/lib/auth.ts, apps/web/src/lib/auth-client.ts, apps/web/src/lib/session.ts, "apps/web/src/app/api/auth/[...all]/route.ts", apps/web/src/proxy.ts, "apps/web/drizzle/0000_*.sql (+ drizzle/meta)"]
  modify: [apps/web/src/lib/db/schema.ts, apps/web/package.json]
  delete: []
---
# 07 · Better Auth server, session helpers, `proxy.ts`, auth migration

## Task
Wire Better Auth (email + password, sessions in Postgres through the Drizzle adapter), generate the auth tables
into `schema.ts`, migrate, and add the two session helpers plus the redirect-only `proxy.ts`.

## Context
- Repo: `/home/apa/Code/smile-score-app/apps/web` (Next 16, App Router, `src/`, alias `@/*`). The Drizzle client is
  in `src/lib/db/index.ts` (`export const db`, a `pg` Pool), and `src/lib/db/schema.ts` is empty. Local Postgres:
  `docker compose up -d db` from the repo root. Spec: PLAN.md §5.1, §7.1, §11 #5–6.
- `pnpm add better-auth`. **VERIFY against the current Better Auth docs** (Next.js integration, Drizzle adapter, CLI)
  before you write code. The names below are the expected ones; correct them if the docs differ, and report it.
- `src/lib/auth.ts`:
  ```ts
  import { betterAuth } from "better-auth";
  import { drizzleAdapter } from "better-auth/adapters/drizzle";
  import { nextCookies } from "better-auth/next-js";
  import { db } from "@/lib/db";
  import * as schema from "@/lib/db/schema";
  export const auth = betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    plugins: [nextCookies()],   // must be last; lets Server Actions set cookies
  });
  ```
  The secret and base URL come from `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`. Leave Better Auth's built-in rate
  limiting at its defaults, and note that in a comment. Add no `additionalFields`: PLAN §1.1 is blank, so the
  defaults (name, email, password) apply.
- `src/app/api/auth/[...all]/route.ts`: `import { toNextJsHandler } from "better-auth/next-js";
  export const { GET, POST } = toNextJsHandler(auth);`
- `src/lib/auth-client.ts`: `export const authClient = createAuthClient()` from `better-auth/react`. The base URL is
  the same origin.
- **Schema:** generate the Drizzle tables (`user`, `session`, `account`, `verification`) with the Better Auth CLI.
  The expected form is `pnpm dlx @better-auth/cli@latest generate --config src/lib/auth.ts --output
  src/lib/db/schema.ts`. VERIFY the command and the flags, and make sure it can resolve `@/` (if it can't, use
  relative imports in `auth.ts`). Keep the header comment in `schema.ts`. Then run `pnpm db:generate` and
  `pnpm db:migrate`. Commit the generated SQL in `drizzle/` with the code.
- `src/lib/session.ts`. These are **the** two helpers every page, route handler and action uses (the PLAN rule:
  every server component, route handler and server action that touches user data checks the session itself,
  because of CVE-2025-29927):
  ```ts
  import { headers } from "next/headers";
  import { redirect } from "next/navigation";
  export async function getSession() {            // route handlers: null -> they return 401
    return auth.api.getSession({ headers: await headers() });
  }
  export async function requireSession() {        // pages + server actions: redirect if none
    const session = await getSession();
    if (!session) redirect("/login");
    return session;
  }
  ```
  Export the session type: `export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>`.
- `src/proxy.ts`. Next 16 renamed `middleware.ts` to `proxy.ts`, and the exported function to `proxy`. VERIFY in the
  Next 16 docs. It handles **optimistic UX redirects only**: no DB call, no real auth. Use `getSessionCookie(request)`
  from `better-auth/cookies`:
  - with no cookie, `/dashboard`, `/results/*` and `/profile` redirect to `/login`
  - with a cookie, `/login` and `/register` redirect to `/dashboard`
  - `export const config = { matcher: ["/dashboard/:path*", "/results/:path*", "/profile/:path*", "/login", "/register"] }`
  - Write a top-of-file comment that it's UX only, and that enforcement lives in `requireSession()` and `getSession()`.
- The pages don't exist yet (08 and 09 add them), so the redirects can 404 for now. That's expected.

## Do not
- Touch files outside the `files` list. If you must, stop and report why.
- Enforce auth in `proxy.ts`, or create `middleware.ts`.
- Use JWT or cookie-cache-only sessions. Sessions are DB-backed.
- Hard-code the secret. Don't print `.env.local` values.
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app/apps/web
grep -q '^BETTER_AUTH_SECRET=.\+' .env.local || echo "set BETTER_AUTH_SECRET in .env.local (openssl rand -base64 32)"
pnpm db:migrate && pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm dev &   sleep 6
curl -s -c /tmp/j -H 'Content-Type: application/json' -d '{"name":"T","email":"t@x.io","password":"password1"}' localhost:3000/api/auth/sign-up/email | head -c 200
curl -s -b /tmp/j localhost:3000/api/auth/get-session | head -c 200        # contains "user"
curl -s -o /dev/null -w '%{http_code}\n' -H 'Content-Type: application/json' -d '{"name":"S","email":"s@x.io","password":"short"}' localhost:3000/api/auth/sign-up/email   # 400
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' localhost:3000/dashboard   # 307 .../login
kill %1
docker compose -f ../../docker-compose.yml exec db psql -U postgres -d smile -c '\dt'   # user, session, account, verification
```
