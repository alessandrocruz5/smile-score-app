---
type: prompt
plan: "[[2026-10-23-smile-score-mvp]]"
id: 10
unit:
status: done
model: sonnet
effort: medium
depends_on: [09]
parallel_group:
files:
  create: ["apps/web/src/app/(app)/profile/page.tsx", "apps/web/src/app/(app)/profile/actions.ts", apps/web/src/components/profile-form.tsx]
  modify: [apps/web/src/lib/validation.ts, apps/web/tests/validation.test.ts]
  delete: []
---
# 10 · Profile page + server action

## Task
Add `/profile`, where users view their email (read-only) and edit their name through a Server Action.

## Context
- Repo: `/home/apa/Code/smile-score-app/apps/web`. Available: `requireSession()` in `src/lib/session.ts`, `auth`
  in `src/lib/auth.ts` (with the `nextCookies()` plugin), the zod schemas in `src/lib/validation.ts`, the shadcn
  `button`, `input`, `label` and `card`, react-hook-form and `@hookform/resolvers`. Copy the form pattern from
  `src/app/(auth)/register/page.tsx`.
- A Server Action is fine here because the payload is small (PLAN §7.5). Uploads never use one, because of the 1 MB
  limit.
- Add to `validation.ts`: `export const profileSchema = z.object({ name: z.string().trim().min(1, "Enter your name").max(100) })`
  and its `ProfileInput` type. Reuse it for `registerSchema.name` only if that's a trivial change. Otherwise leave
  register alone.
- `src/app/(app)/profile/actions.ts`:
  ```ts
  "use server";
  export async function updateProfile(input: ProfileInput): Promise<{ ok: true } | { ok: false; error: string }> {
    await requireSession();
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Enter a valid name" };
    await auth.api.updateUser({ headers: await headers(), body: { name: parsed.data.name } });
    revalidatePath("/", "layout");
    return { ok: true };
  }
  ```
  **VERIFY** the `auth.api.updateUser` call shape in the Better Auth docs.
- `profile/page.tsx` (a server component): `const session = await requireSession()`. It renders a card with the
  email (read-only) and `<ProfileForm defaultName={session.user.name} />`.
- `src/components/profile-form.tsx` (`"use client"`): react-hook-form with `profileSchema`. It calls `updateProfile`
  and shows "Saved" or the error in `role="status"` / `role="alert"`. The button is disabled while saving.
- Extend `tests/validation.test.ts`: `profileSchema` trims whitespace and rejects an empty name.

## Do not
- Touch files outside the `files` list. If you must, stop and report why.
- Allow changing the email or password (out of scope).
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app/apps/web
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
- Phase 2 "Done when" (owner, M2): register, log in, edit the name (the header updates), log out. The protected
  pages redirect when you're logged out. `POST /api/uploads` returns 401 without a session.
