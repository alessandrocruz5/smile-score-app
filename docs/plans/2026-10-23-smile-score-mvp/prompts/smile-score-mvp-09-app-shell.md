---
type: prompt
plan: "[[2026-10-23-smile-score-mvp]]"
id: 09
unit:
status: todo
model: sonnet
effort: medium
depends_on: [08]
parallel_group:
files:
  create: ["apps/web/src/app/(app)/layout.tsx", "apps/web/src/app/(app)/dashboard/page.tsx", apps/web/src/components/sign-out-button.tsx, apps/web/src/app/api/uploads/route.ts]
  modify: [apps/web/src/app/page.tsx]
  delete: []
---
# 09 · Protected app shell, logout, root redirect, uploads 401 stub

## Task
Add the authenticated `(app)` route group: its layout with nav and logout, a placeholder dashboard, the root redirect,
and a stub `POST /api/uploads` that returns 401 without a session (Phase 2's "Done when" needs it).

## Context
- Repo: `/home/apa/Code/smile-score-app/apps/web`. `src/lib/session.ts` exports `getSession()` (returns
  null if there's no session; for route handlers) and `requireSession()` (redirects to `/login`; for pages and
  actions). `src/lib/auth-client.ts` exports `authClient`. The shadcn `button` and `card` components exist.
- **Rule:** every server component, route handler and action that touches user data calls `requireSession()` or
  `getSession()` itself. A layout check alone isn't enough, because layouts don't re-render on client navigation.
- `src/app/(app)/layout.tsx` (a server component): `const session = await requireSession()`. It renders a header
  with "Smile Score" (a link to `/dashboard`), links to Dashboard and Profile, `session.user.name`, and
  `<SignOutButton />`, then `<main className="mx-auto max-w-5xl p-4">{children}</main>`.
- `src/components/sign-out-button.tsx` (`"use client"`): a shadcn `Button` (variant `outline`) that runs
  `await authClient.signOut()`, then `router.push("/login")` and `router.refresh()`.
- `src/app/(app)/dashboard/page.tsx`: `await requireSession()`, then render a heading "Your smiles" and a
  placeholder card ("Upload arrives in Phase 3"). Prompt 15 replaces the body.
- `src/app/page.tsx`: `const session = await getSession(); redirect(session ? "/dashboard" : "/login")`.
- `src/app/api/uploads/route.ts`:
  ```ts
  export async function POST() {
    const session = await getSession();
    if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
    return Response.json({ error: "not_implemented" }, { status: 501 }); // replaced in prompt 14
  }
  ```

## Do not
- Touch files outside the `files` list. If you must, stop and report why.
- Add the profile page (that's prompt 10).
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app/apps/web
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm dev & sleep 6
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/uploads     # 401
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' localhost:3000/       # 307 .../login
kill %1
```
- In the browser: register, see the dashboard and nav, log out, land on `/login`. `/dashboard` then redirects to
  `/login`.
