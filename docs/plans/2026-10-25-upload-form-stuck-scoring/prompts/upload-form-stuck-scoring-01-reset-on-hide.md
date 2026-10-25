---
type: prompt
plan: "[[2026-10-25-upload-form-stuck-scoring]]"
id: 01
unit:
status: done
model: sonnet
effort: medium
depends_on: []
parallel_group: A
files:
  create: []
  modify: [apps/web/src/components/upload-form.tsx]
  delete: []
---
# 01 · Reset upload form when the dashboard is hidden

## Task
In `apps/web/src/components/upload-form.tsx`, make the effect cleanup reset the whole form, so that leaving
the dashboard leaves a fresh, idle form to come back to.

1. Add `const fileInputRef = useRef<HTMLInputElement>(null);` next to the other refs (line 28-29), and pass
   `ref={fileInputRef}` to the `<input id="photo" type="file">` (line 101).
2. Replace the unmount effect at lines 37-42 with a **`useLayoutEffect`** (the Next docs' pattern for resetting on
   hide: the cleanup runs synchronously before the route is hidden, so no stale state flashes) whose cleanup does
   the following, in this order:
   - `selectionRef.current += 1;`, so a downscale still in flight is ignored. Don't write `selectionRef.current++`:
     `react-hooks/exhaustive-deps` treats `++` as a read and warns (verified at audit);
   - revokes `urlRef.current` if it's set, then sets `urlRef.current = null`;
   - `setPreviewUrl(null)`, `setPhoto(null)`, `setConsent(false)`, `setError(null)`, `setSubmitting(false)`;
   - clears the file input: `if (input) input.value = "";`, where `const input = fileInputRef.current;` is
     captured in the **effect body**, not read inside the cleanup. This satisfies
     `react-hooks/exhaustive-deps`'s "ref value will likely have changed" rule.
   Keep the dependency array `[]`. Change the React import to `import { useLayoutEffect, useRef, useState } from "react";`
   (`useEffect` would be left unused, which is a lint warning). Replace the effect's comment with one short line explaining why, for
   example: `// cacheComponents keeps this route alive in <Activity>; hiding it runs this cleanup, so we come back to a fresh form.`
3. Leave `onSubmit` unchanged. The early `return` after `router.push` still keeps "Scoring…" during the route
   change, and the cleanup resets `submitting` once the dashboard is hidden.

## Context
- Repo root: `/home/apa/Code/smile-score-app`, web app in `apps/web` (Next 16.4.3, React 19.3.0, pnpm).
- **Why this is the fix:** `apps/web/next.config.ts` has `cacheComponents: true`. Next then keeps visited
  routes in React `<Activity mode="hidden">`, which **preserves component state** and **runs effect cleanups**
  on hide (and re-runs setups on show). Today the success path never resets `submitting`, so the button is
  stuck on "Scoring…" when you return. The cleanup also revokes the preview URL while `previewUrl` still
  holds it, which leaves a broken `<img>`. Calling state setters in a cleanup is fine: they apply to the
  hidden tree, and they're no-ops on a true unmount.
- Existing patterns to keep: `replacePreview` (lines 31-35) stays as it is, since it's still used by `onFileChange`.
  Code style: double quotes, semicolons, 2-space indent, short `//` comments only where the reason isn't
  obvious (see line 29 and line 79).
- `UploadForm` is rendered only by `apps/web/src/app/(app)/dashboard/page.tsx:19` and takes no props. Keep
  the export and signature unchanged.
- Reference: `apps/web/node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md` (§"Resetting stale
  status messages"). Read it only if something here is unclear.
- There's no DOM test harness (vitest runs `environment: "node"`). Don't add one.

## Do not
- Touch files outside the `files` list. If you must, stop and report why.
- Add dependencies, abstractions or config that aren't listed here: no `useTransition`, no new helper hook,
  no `cacheComponents` change.
- Change `onSubmit`, the error-code handling, or the JSX beyond adding `ref={fileInputRef}`.
- Touch the uncommitted edits already in `apps/web/src/lib/scorer.ts` or `apps/scorer/.env.example`.
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app/apps/web && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
```bash
cd /home/apa/Code/smile-score-app/apps/web && npx eslint --max-warnings 0 src/components/upload-form.tsx
```
- `git diff --stat`: apart from the pre-existing changes to `apps/web/src/lib/scorer.ts`, `apps/scorer/.env.example`
  and `docs/plans/`, only `apps/web/src/components/upload-form.tsx` changed.
- In the browser (scorer up, `pnpm dev`, logged in): score a photo, land on `/results/<id>`, then return via
  the header "Dashboard" link, the "Back to dashboard" link and the browser Back button. Each time the button
  reads "Score my smile", the inputs are enabled, and there's no preview, filename or consent tick.
- Pick a photo, go to Profile, come back: no broken preview image.
