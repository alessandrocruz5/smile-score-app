---
type: prompt
plan: "[[2026-10-23-smile-score-mvp]]"
id: 08
unit:
status: done
model: sonnet
effort: medium
depends_on: [07]
parallel_group:
files:
  create: [apps/web/src/lib/validation.ts, "apps/web/src/app/(auth)/login/page.tsx", "apps/web/src/app/(auth)/register/page.tsx", apps/web/tests/validation.test.ts, "apps/web/src/components/ui/* (shadcn add)"]
  modify: [apps/web/package.json, apps/web/pnpm-lock.yaml]
  delete: []
---
# 08 · Login and register pages + auth zod schemas

## Task
Build `/login` and `/register` with react-hook-form and zod, signing in and up through the Better Auth client. On
success, go to `/dashboard`.

## Context
- Repo: `/home/apa/Code/smile-score-app/apps/web`. `src/lib/auth-client.ts` exports `authClient`
  (`better-auth/react`). shadcn/ui is initialized, with no components yet. Spec: PLAN.md §7.5.
- `pnpm add react-hook-form @hookform/resolvers`, then `pnpm dlx shadcn@latest add button input label card`.
- `src/lib/validation.ts` is the **single** home for zod schemas, shared by client and server. Start it with:
  ```ts
  export const loginSchema = z.object({ email: z.email(), password: z.string().min(1, "Enter your password") });
  export const registerSchema = z.object({
    name: z.string().trim().min(1, "Enter your name").max(100),
    email: z.email(),
    password: z.string().min(8, "At least 8 characters"),
  });
  export type LoginInput = z.infer<typeof loginSchema>; export type RegisterInput = z.infer<typeof registerSchema>;
  ```
  Check the installed zod major version. With zod 3, use `z.string().email()` instead of `z.email()`.
- Both pages are `"use client"` components using `useForm({ resolver: zodResolver(schema) })`, and shadcn
  `Card`, `Label`, `Input` and `Button`. They show field errors under the inputs, disable the button while submitting,
  and show the server error message (from `{ error }` returned by `authClient.signIn.email(...)` /
  `authClient.signUp.email(...)`) in a `role="alert"` paragraph. On success, call `router.push("/dashboard")`
  and then `router.refresh()`. Each page links to the other.
- Accessibility: tie every `Label` to its input (`htmlFor` and `id`), and use `autoComplete` values `email`,
  `current-password`, `new-password` and `name`.
- `tests/validation.test.ts`: `registerSchema` rejects a 7-character password, a bad email and an empty name, and
  accepts a valid input. `loginSchema` accepts a valid input.

## Do not
- Touch files outside the `files` list. If you must, stop and report why.
- Call auth from a Server Action here. The client SDK posts to `/api/auth/*`.
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app/apps/web
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
- In `pnpm dev`: registering a new user lands on `/dashboard` (a 404 page is fine until 09). A wrong password shows
  an error. A 7-character password shows "At least 8 characters".
