---
type: plan
kind: hotfix
status: in-progress
repo: smile-score-app
delivery: local
base:
sprint:
epic:
created: 2026-10-25
risk: low
prompts: 1
graph_built: none
tags: [plan]
---
# Upload form stuck on "Scoring…" after returning to the dashboard

## Request
> going back to dashboard after scoring keeps the button at "Scoring..." state. is it because of the slow render rate limits? or is there actually a bug.

| # | Requirement |
|---|---|
| R1 | Answer the question: is the stuck "Scoring…" label caused by Render's slowness or rate limits, or by a bug? |
| R2 | After a successful score, going back to `/dashboard` (the header link, "Back to dashboard", or the browser Back button) shows the upload form idle: "Score my smile", inputs enabled. |
| R3 | The form the user comes back to is fresh: no old photo, preview, filename, consent tick or error. The old preview's blob URL was already revoked, so leaving it would show a broken image. |

## Diagnosis (R1)
**It's a bug, not rate limiting.** By the time the browser lands on `/results/<id>`, the server has already
returned `201`, so scoring is finished. Render's speed (cold starts) only stretches the wait *before* that
redirect. Nothing about the scorer can affect the button afterwards.

The cause is client state that survives navigation:
1. On `201`, `onSubmit` calls `router.push` and returns early **without** `setSubmitting(false)`, on purpose,
   to keep the loading label during the route change (`upload-form.tsx:76-79`).
2. `next.config.ts` sets `cacheComponents: true` (Next 16.4.3). With Cache Components, Next keeps
   previously visited routes alive in React `<Activity mode="hidden">` instead of unmounting them, so
   component state is **preserved**. When the user returns, the same `UploadForm` instance comes back
   with `submitting === true`, plus the old `photo` and `consent`.
3. Hiding an Activity runs effect cleanups. The existing unmount effect (`upload-form.tsx:37-42`) therefore
   revokes the preview blob URL on hide, while `previewUrl` state still points at it, so the preview `<img>`
   is broken on return. Same root cause, same file, hence R3.

## Context used
- Code: `apps/web/src/components/upload-form.tsx:27,66-95,139-141`: `submitting` is never reset on the success path.
- Code: `apps/web/src/components/upload-form.tsx:37-42`: the unmount-only cleanup revokes `urlRef.current`.
- Code: `apps/web/next.config.ts`: `cacheComponents: true`, `partialPrefetching: true`.
- Code: `apps/web/package.json`: `next` 16.4.3, `react` 19.3.0; vitest `environment: "node"`, no DOM testing library.
- Code: `apps/web/src/app/(app)/dashboard/page.tsx:19`: the only render site of `<UploadForm />`.
- Code: `apps/web/src/app/(app)/layout.tsx:27`, `results/[id]/page.tsx:20`: the `<Link href="/dashboard">` return paths.
- Code: `src/components/delete-upload-button.tsx:23-24`, `login/page.tsx:32-33`: other `router.push` call sites; none keep a pending flag across navigation, so they're unaffected.
- Note: `README.md#Known limitations`, `#What I'd do next`: rate limiting is Better Auth's defaults only, and scoring is synchronous inside the upload request. That confirms the scorer can't influence post-redirect UI.
- Note: `docs/plans/2026-10-23-smile-score-mvp`: verification commands (no `## Commands` profile exists).
- Graph: none (`graphify-out/` absent). Grep was used instead.

## Decisions
- **Reset the whole form in the `useLayoutEffect` cleanup that Activity runs on hide** (audit: the Next 16.4.3
  docs' pattern, `preserving-ui-state.md`). Leaving the dashboard, whether
  on the post-score redirect or any other navigation, resets `submitting`, `photo`, the preview, `consent`,
  `error` and the file input. The success path stays as it is: the label still reads "Scoring…" until the
  route changes, then the hidden form resets itself. This is the smallest diff, and it fixes R2 and R3 with
  one mechanism.
  Rejected: (a) `setSubmitting(false)` before `router.push`. It's simpler, but it re-enables the button
  during the route change (a double-submit window) and doesn't fix R3. (b) `useTransition` around
  `router.push`. It fixes the label but adds a second pending flag and still leaves R3 broken. (c) `<Fragment key={useRouter().bfcacheId}>`: it restores state on browser
  Back/Forward, so R2 fails on Back (audit).
- **Reset on every hide, not only after a submit** (the docs' `shouldReset` variant). Sign-out does
  `router.push("/login")`, so today a previous user's chosen photo survives into the next login on the same
  browser. Resetting on every hide closes that (audit).
- **Also correct if the route ever truly unmounts** (Activity off, or evicted from the router cache): the
  cleanup still revokes the URL, the setters become no-ops, and a remount starts fresh.
- **No automated component test.** The web tests run in `environment: "node"` with no DOM library, and adding
  jsdom plus Testing Library for one component is a new dependency this hotfix doesn't justify. R2 and R3
  are verified manually in the browser (End-to-end verification).

**Non-goals:** changing scorer latency, Render cold starts or rate limiting; changing `cacheComponents`;
adding a DOM test harness; guarding `onSubmit` when the user leaves mid-submit (see Open questions); a dashboard history refresh after upload (see Open questions); any change to the
uncommitted `apps/web/src/lib/scorer.ts` or `apps/scorer/.env.example` edits already in the tree.

## Change list
| File | Action | Why | Req | Prompt |
|---|---|---|---|---|
| `apps/web/src/components/upload-form.tsx` | M | Reset form state, including `submitting`, in the hide/unmount cleanup; add a file-input ref so the cleanup can clear the chosen filename | R2, R3 | 01 |

## Blast radius
**Risk:** low. One client component, one render site, and no shared code, contracts or data touched.

| Affected | Kind | Via | Breaks? | Mitigation |
|---|---|---|---|---|
| `app/(app)/dashboard/page.tsx` | Direct | renders `<UploadForm />` with no props | No: the props and export are unchanged | — |
| Upload success flow (`POST /api/uploads` → `/results/<id>`) | Behaviour | `onSubmit` | No: "Scoring…" still shows until navigation, and the reset happens once the form is hidden | Manual check, step 1 |
| Upload error flow (4xx/5xx shown in `role="alert"`) | Behaviour | `onSubmit` | No: that path is unchanged and resets `submitting` as before | Manual check, step 4 |
| Unsubmitted pick → navigate away → back | Behaviour | cleanup | Intended change: the pick is discarded instead of showing a broken preview | Recorded in Decisions |
| In-flight downscale when leaving | Behaviour | `selectionRef` | No: the cleanup bumps `selectionRef`, so a late result is ignored | Done in prompt 01 |
| `tests/*.test.ts` | Non-graph | none import `upload-form` | No | — |
| `eslint` `react-hooks/exhaustive-deps` | Non-graph | reading a DOM ref in a cleanup; `selectionRef.current++` in a cleanup | It would warn (the `++` warning verified at audit) | Capture `fileInputRef.current` in the effect body; use `selectionRef.current += 1`; `eslint --max-warnings 0` in Done when (prompt 01) |
| Sign-out → another login on the same browser **(audit)** | Behaviour | `sign-out-button.tsx:13-14` `router.push`; Activity keeps the dashboard | Fixed as a side effect: the previous user's photo no longer survives | Optional manual step 5 |
| Leaving mid-submit **(audit)** | Behaviour (pre-existing) | `upload-form.tsx:75-94`, no staleness check after `await fetch` | Not caused by this change: a late `201` still navigates, and a late error is set on the hidden form | Non-goal; see Open questions |

**Known risks in the touched area:** none documented. Cache Components' Activity behaviour isn't recorded in
`docs/DECISIONS.md`; see Open questions.

## Prompts
| # | Title | Unit | Model | Effort | Depends | Group | Files |
|---|---|---|---|---|---|---|---|
| 01 | Reset upload form when the dashboard is hidden | — | sonnet | medium | — | A | `apps/web/src/components/upload-form.tsx` |

## End-to-end verification
```bash
# No ## Commands profile exists; these are the web commands from the MVP plan (PLAN §9/§10).
cd apps/web && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
Manual (with `docker compose up -d` for the scorer and `pnpm dev`, logged in):
1. **R2, header link:** pick a photo, tick consent, click "Score my smile". The label reads "Scoring…" until
   `/results/<id>` loads. Click "Dashboard" in the header: the button reads "Score my smile" and is disabled
   (no photo), and the file input and consent checkbox are enabled.
2. **R2, browser Back and "Back to dashboard":** repeat step 1, returning once with the browser Back button
   and once with the "Back to dashboard" link. Same result.
3. **R3:** pick a photo (the preview shows), go to Profile, come back. No broken image, no filename in the
   file input, consent unticked.
4. **Regression:** with the scorer stopped (`docker compose stop scorer`), submit. The "temporarily
   unavailable" error shows and the button returns to "Score my smile" on the same page.
5. **Optional (audit), sign-out:** pick a photo, sign out, log in again. The form is empty.

Also: `cd apps/web && npx eslint --max-warnings 0 src/components/upload-form.tsx`.

## Rollback
Revert the single-file change to `apps/web/src/components/upload-form.tsx`.

## Open questions
- **Dashboard history on return.** The upload never calls `router.refresh()`. When you come back with the
  browser Back button, the history grid may come from the client router cache and miss the new score. I
  didn't verify this; check it during manual step 2. If it's stale, it's a separate small fix
  (`router.refresh()` after the push, the pattern in `delete-upload-button.tsx:23-24`). Should it be added
  to this plan?
- Should `docs/DECISIONS.md` record that `cacheComponents` preserves client state across navigation, since it
  will bite any future form with a pending flag? It's out of scope here unless you want it.

## Open questions (audit)
- **Leaving mid-submit.** `onSubmit` doesn't check whether the form was hidden while `fetch` was in flight, so a late
  `201` pulls the user to the results page from elsewhere. Pre-existing, so a separate fix if wanted.

## Log
- 2026-10-25: planned
- 2026-10-25: audited, 3 fixes applied (PASS-WITH-CHANGES)
- 2026-10-25: 01 done (sonnet, 0 retries): form resets in useLayoutEffect cleanup; lint/typecheck/test/build green; rollback point 3b9ae88. Manual browser steps 1-5 pending.
