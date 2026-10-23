# Audit: [[2026-10-23-smile-score-mvp]]

## Audit 2026-10-23: PASS-WITH-CHANGES
Graph built: none (greenfield; only `README.md`, `PLAN.md` and the plan are tracked) · Symbols traversed: 0 ·
Missed blast-radius items: 4 (Phase 2 prod env/migration timing, build-time storage throw, mediapipe 1.x major,
Neon pooled URL for migrations)

Method: no code exists, so the blast radius was recomputed from the plan's own cross-prompt contracts (HTTP JSON,
env keys, DB tables, platform limits, deploy order). The VERIFY items were spot-checked against PyPI, and two
Done-when claims were run in a scratch repo.

| Sev | Check | Finding | Evidence | Fix |
|---|---|---|---|---|
| FIX | Breakage / deploy | **The production env and migrations arrive one phase late.** Phase 2 (07–10) adds Better Auth, which needs the auth tables plus `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` on Vercel. M2 sets none of them; M3 runs `db:migrate` on Neon and sets the env vars only after 16. Vercel auto-deploys every push, so prod runs auth without its tables or secret from the Phase 2 push until M3. The plan's own row says "Run them on Neon in M3". | plan:212–219, plan:150 (blast-radius row) | M2: before pushing Phase 2, run `DATABASE_URL='<neon direct url>' pnpm db:migrate` (env wins over `.env.local`, verified below), set `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` (prod domain) on Vercel, push, then smoke-test register/login on prod. M3: before pushing Phase 3, migrate `0001`, set `SCORER_URL`/`SCORER_API_KEY`, create and connect the private Blob store, then push and test. |
| FIX | Breakage | **The storage adapter throws at import time on Vercel builds.** 12 picks the adapter at module load and throws when `VERCEL` is set without `BLOB_READ_WRITE_TOKEN`. Vercel exposes the `VERCEL` system env var at build time, and `next build` loads route modules while collecting page data, so a push made before the Blob store is connected can fail the *build* instead of failing loudly at runtime. The plan lists this throw as a mitigation (plan:149); it is a risk too. | prompts/…-12:37–39 (`export const storage: Storage` + throw) | Keep the loud failure but make it lazy: `export function getStorage(): Storage` (memoized), which throws on the first call. 14 calls `getStorage()`. Update 12's tests/context and 14's "Available" list. |
| FIX | Usability / independence | **01 ∥ 02 aren't independent.** 02's Done-when runs `docker compose up -d db`, which needs 01's `docker-compose.yml`. Run in parallel, 02 fails whenever it reaches that line first, and the two prompts race on `docker compose up` for the same project. | prompts/…-01:10, …-02:10 (`parallel_group: A`); …-02:82 | Drop the group: 02 `depends_on: [01]`, `parallel_group:` empty. Update the plan's Prompts table and its Parallelism note. The parallel saving is a few minutes. |
| FIX | Usability | **02's `.env.example` ignore check is a false pass.** `git -C .. check-ignore` from `apps/web` resolves to `apps/apps/web/.env.example`. It prints `ok` even when the file is ignored. | Scratch repo with `apps/web/.gitignore` = `.env*`: prompt's command → `ok`; root-relative command → `EXAMPLE IGNORED: fix` | Use `git -C /home/apa/Code/smile-score-app check-ignore -q apps/web/.env.example && echo "EXAMPLE IGNORED: fix" \|\| echo ok`. |
| FIX | Notes & constraints (VERIFY) | **The mediapipe premise is stale.** The current mediapipe is **1.1.1** (a new major: 1.0.0 shipped 2026-07-27, and 1.1.1 on 2026-10-14). Linux wheels are `py3-none-manylinux_2_28_x86_64`, not `cp312`. PLAN §6.2/§14 and prompt 04's expected API were written for 0.10.x. Told to look for a cp312 wheel, the executor finds none and may stop or pick wrongly. Still true and worth keeping: `requires_dist` includes `opencv-contrib-python`, so libGL is still needed. | PyPI JSON: `latest 1.1.1`; files `mediapipe-1.1.1-py3-none-manylinux_2_28_x86_64.whl`; releases 0.10.31…0.10.35, 1.0.0…1.1.1 | 01: check for a `py3-none-manylinux_2_28_x86_64` wheel. Install the latest, pin the exact version, and report it. 04: VERIFY against the **installed** major. If 1.x moved `FaceLandmarker` options or `FaceLandmarksConnections`, pin `mediapipe==0.10.35` (the last 0.10, with the same deps) rather than adapt to an undocumented API. Record the choice in DECISIONS (18). |
| FIX | Requirements (R8) | **The security checklist says "Type allowlist … enforced on both web and scorer", and neither side enforces it on content.** The web checks only the client-declared `file.type`, and sharp then accepts GIF/TIFF/SVG/AVIF. The scorer accepts any format Pillow opens. A reviewer can send `-F 'image=@x.gif;type=image/jpeg'` and get a 201. | prompts/…-14:45–46 (type check on `file.type`); …-12:50 (sharp has no format check); …-05:54–55 (Pillow, no format check); PLAN §12 | 12: in `normalizeImage`, read `sharp(input).metadata()` and throw unless `format ∈ {jpeg, png, webp}`. Add an image test with a GIF that's rejected. 05: after `Image.open`, return 415 unless `img.format in {"JPEG","PNG","WEBP"}`. Add a test with a GIF and expect 415. |
| FIX | Requirements (R7) / PLAN fidelity | **Safari HEIC is blocked although PLAN keeps it in scope.** PLAN lists only "HEIC from *non-Safari* browsers" as a non-goal, and §7.2 rejects by decode failure. 15 rejects anything not in `ALLOWED_IMAGE_TYPES` *before* decoding, so desktop Safari's `image/heic` is refused even though Safari can decode it. | PLAN §1.3, §7.2 step 4; prompts/…-15:39 | 15: drop the pre-decode type check. Keep the 25 MB raw check and let `DecodeError` produce `unsupported_image`. The server allowlist is unaffected, because the browser always sends the downscaled JPEG. A `.txt` renamed `.jpg` still fails to decode. |
| FIX | Usability (verification gap) | **Inference inside the Docker image is never exercised by a command.** PLAN Phase 1's Done when is "pytest passes locally **and in Docker**". 05's Docker check posts `README.md`, which returns 415 before `detect()` runs, so the slim image's mediapipe runtime (the plan's own top infra risk) is proven only by the owner's manual curl. | PLAN §10 Phase 1; prompts/…-05:82–84 | 05 Done-when: add `docker compose run --rm -v "$PWD/apps/scorer/tests:/app/tests:ro" -v "$PWD/apps/scorer/pyproject.toml:/app/pyproject.toml:ro" scorer sh -c 'pip install -q pytest httpx && python -m pytest -q -rs'`. This runs the no-face test (a real `detect()`) in the image. |
| FIX | Usability (verification gap) | **The server-side `too_large` path (R7) isn't verified.** No command posts more than 4 MB. 14's Done-when also leaks a `pnpm dev` (`(pnpm dev &)` is never killed), and that server holds port 3000 for 15/16. | prompts/…-14:46, …-14:80 | 14: add `head -c 5000000 /dev/urandom > $J/big.jpg; curl -s -b $J/a -F "image=@$J/big.jpg;type=image/jpeg" localhost:3000/api/uploads   # 413 too_large`. Start dev with `pnpm dev & DEV=$!` and end with `kill $DEV; pkill -f "next dev" \|\| true`. |
| FIX | Independence | **06's Done-when expects behaviour its Context never specifies** ("prints 'no images' cleanly, exit 0"). | prompts/…-06:47 | 06 Context: "If no `*.jpg` match, print `no images in <dir>` and exit 0 before loading the model." Loading after the check also lets the check run without the model. |
| NOTE | Notes | The plan says `PLAN.md` is untracked and must be committed before 01. It is already committed. | `git log --stat`: `8462a13 Plan and scaffold` adds `PLAN.md`; plan:21, :57, :145 | Fix the three lines when the fixes are applied. |
| NOTE | Notes | `storage/disk.ts` vs PLAN §4's `storage/local.ts`: an unrecorded rename the owner would have to explain. | PLAN.md:149; change list row 12 | Use `local.ts` (`localStorage` collides with the DOM global, so name the export `localDiskStorage`), or keep `disk.ts` and say why in DECISIONS. |
| NOTE | Breakage | Neon's pooled (PgBouncer) URL is meant for the app. Neon recommends the direct URL for schema migrations. | plan:205, :214 | In M2/M3, migrate with the **direct** Neon URL, and keep the pooled one in Vercel's `DATABASE_URL`. |
| NOTE | Breakage | Re-running the Better Auth CLI with `--output src/lib/db/schema.ts` after 11 would overwrite the `uploads` table. | prompts/…-07:49 | 07: add a header line to `schema.ts`: "Generated by Better Auth CLI; re-running it overwrites this file, so re-append `uploads` (prompt 11)". |
| NOTE | Breakage | `BETTER_AUTH_URL` is pinned to the prod domain, so sign-in on Vercel *preview* URLs fails Better Auth's origin check. | PLAN §8 | Smoke-test only on the production domain, and say so in M3/M4. |
| NOTE | Optimization | Each page does two DB session lookups (layout + page), and each history thumbnail does a session query, a row query and a full-size blob stream with `no-cache`, so 50 thumbnails cost about 100 queries per dashboard view. That's fine at MVP scale. | prompts/…-09 (layout + page `requireSession`); …-14:66 | Optional: wrap `getSession` in React `cache()` (one line in 07). Keep `private, no-cache` per PLAN §2.2. |
| NOTE | Breakage | mediapipe pulls in non-headless `opencv-contrib-python` and `matplotlib`. The image and its RSS may get close to Render's 512 MB. | PyPI `requires_dist` for 1.1.1 | 05 Done-when: `docker stats --no-stream` after a scored request. Note the number in the Phase 1 summary. |
| NOTE | Usability | CI's web job runs no `pnpm build` (it matches PLAN), so build-time breakage shows up first on Vercel. | prompts/…-17:32 | Optional: add `pnpm build` with dummy `BETTER_AUTH_SECRET`/`DATABASE_URL` env. |
| NOTE | Independence | 04 may edit `tests/test_health.py`, which isn't in its `files`. | prompts/…-04:72, :78 | Add it to 04's `files.modify`. |
| NOTE | Model fit | 17 is one YAML file built to an exact spec. | prompts/…-17 | `haiku` would do. Keep `sonnet` if you'd rather not risk a retry on the action-version checks. |

**Bloat estimate:** planned ~70 hand-written files (plus the create-next-app/shadcn scaffold), ~3.0k LOC including
tests; minimal viable ~70 / ~2.9k. Every row traces to an R# or a PLAN rule; the only additions (`upload_failed`,
the consent line, `X-Content-Type-Options`, the `unauthorized` copy) are a few lines each and justified. The diff
is in proportion to the request.
**Model cost:** fits. 07 and 14 on `opus` are justified (auth/sessions; the IDOR boundary). 06 on `haiku` fits.
17 could drop to `haiku` (optional).

**Verified during the audit:**
- `DATABASE_URL=neon node -e 'process.loadEnvFile(".env.local"); …'` printed `neon` (Node v26.12.0), so an
  explicit env var wins over `.env.local`. That makes `DATABASE_URL=… pnpm db:migrate` against Neon safe with 02's
  `drizzle.config.ts`.
- The `check-ignore` false pass was reproduced in a scratch repo (see the table).

**Planner claims disproved:** "the storage adapter throws on Vercel without a token" as a pure mitigation (it can
also fail the build); "run them on Neon in M3" (too late, since Phase 2 deploys first); "VERIFY a cp312 wheel"
(that wheel tag doesn't exist, and the package is now 1.x).

### Applied 2026-10-23 (owner approved)
All 10 FIX findings are applied. Notes applied: PLAN.md stale lines, `storage/local.ts` naming, Neon direct URL for
migrations, the `schema.ts` regeneration warning, prod-domain-only smoke tests, React `cache()` on `getSession`,
`test_health.py` declared in 04's `files`, and `docker stats` in 05. Not applied (optional): `pnpm build` in CI, and
18 (CI) on haiku.
Owner decisions taken at the same time: registration is exactly name, email and password (Open question 2
resolved), and "delete an upload" is added as R13, new prompt 17. CI and docs are renumbered 17→18 and 18→19.
Prompt 17 was checked against the same checklist: it copies 14's owner-check pattern, sits behind 16 (which owns
the results page it modifies), is on sonnet/high, and its Done-when covers 401, the cross-user 404, the non-UUID
404, the 204, and file and row removal.
Status → `audited`.

## Audit 2026-10-23 (amendment R14, photo privacy): PASS
Scope: R14 A/B/C/E, as applied to 05, 11, 14, 15, 17, new 18, 20, the plan and M3/M5. The checks were run on the
new and changed prompts only.

| Sev | Check | Finding | Evidence | Fix |
|---|---|---|---|---|
| NOTE | Notes & constraints | `purgeExpiredUploads` doesn't filter on `user_id`, which a literal reading of PLAN §12 ("every upload query filters on `user_id`") forbids. It's a deliberate system job that takes no user input. | prompts/…-18 (`purgeExpiredUploads`) | Already documented in 18's comment and the plan's Decisions. Make sure the README Privacy section says it, so the Q&A answer is ready. |
| NOTE | Optimization | The purge scans on `created_at` alone, so the `(user_id, created_at)` index doesn't help. | prompts/…-18 | Fine at demo volume (≤100 rows a day). Add `index(created_at)` only if this ever leaves MVP scale. |
| NOTE | Usability | The 18/17 Done-when checks of actual deletion need the owner's M1 fixture. Without it, they print a skip line. | prompts/…-17, …-18 (`if test -f "$IMG"`) | Do M1 before Phase 3. |

Checked and clean: every curl that should reach a later check sends `-F consent=true`, and 14 asserts the
field-less request returns 400. `consent_required` is in `uploadErrorCodes` with copy, and 11's "every code has a
message" test covers it. `PHOTO_RETENTION_DAYS` is a single constant shared by 15 and 18, with no env key.
`CRON_SECRET` is in `.env.example` and in M3, and the route fails closed without it. 18 depends on 17
(`uploads.ts`), and 19 depends on 18 and 06. 18 is sonnet/high (one comparison, guarded by a unit test and a
Done-when that checks both an aged row and a recent one). There are no new dependencies.
**Bloat estimate:** +4 files / ~+250 LOC, all traced to R14.

## Audit 2026-10-23 (re-audit, full plan after R13 + R14): PASS-WITH-CHANGES
Graph built: none (still no code; `git ls-files` = README, PLAN.md, plans) · Symbols traversed: 0 (14 cross-prompt
contracts traced instead: HTTP JSON, env keys, DB tables, cookies/redirects, test env, lockfiles) · Missed
blast-radius items: 3 (`proxy.ts` cookie ↔ `requireSession` redirect coupling, `SCORER_API_KEY` precedence in the
Docker pytest, empty `BETTER_AUTH_SECRET` in `.env.local` under production mode)

Method: every prompt read in full; claims tested in a scratch dir against better-auth 1.7.12, Next 16.4.3,
pnpm 10.33.0 and Node 26.12.0, and the verify step checked in `~/.claude/skills/build-unit/SKILL.md`.

| Sev | Check | Finding | Evidence | Fix |
|---|---|---|---|---|
| FIX | Breakage | **Infinite redirect loop on a stale session cookie.** `proxy.ts` sends `/login` → `/dashboard` whenever a session cookie *exists* (`getSessionCookie` checks presence only, no DB). `(app)/layout.tsx` sends `/dashboard` → `/login` when the session is *invalid*. A cookie whose session is gone (DB reset with `docker compose down -v`, which the plan's own Rollback uses; the M5 `truncate "user" cascade`; an expired or revoked session) bounces between the two until the browser stops with ERR_TOO_MANY_REDIRECTS. The reviewers' browsers after M5 are the likeliest victims. | prompts/…-07:74–78 (cookie → `/login`,`/register` redirect to `/dashboard`); …-09:28 (`requireSession()` in the layout); …-07:66–69 (`redirect("/login")`) | 07: keep only "no cookie + protected path → `/login`". Drop the cookie → `/dashboard` rule, and drop `/login` and `/register` from the `matcher`. The `/` page (09) already does a real `getSession()` redirect. Record it in Decisions. |
| FIX | Usability | **The Docker pytest in 05 sends the wrong key.** `conftest.py` uses `os.environ.setdefault("SCORER_API_KEY", "test-key")`, but `docker compose run scorer` inherits the compose env `SCORER_API_KEY=dev-scorer-key`, so `setdefault` is a no-op there. 05 never says which key the tests send. An executor that writes the natural `{"X-Scorer-Key": "test-key"}` gets 401 for the no-face, GIF and size cases in the image, and fixing it means editing `conftest.py`, which isn't in 05's `files`. | prompts/…-01:62 (`setdefault`); …-01:70–71 (compose env); …-05:68–77 (no key given); …-05:97–98 (Docker run) | 01: `os.environ["SCORER_API_KEY"] = "test-key"` (assignment, not `setdefault`). 05: the tests send `config.SCORER_API_KEY`. 19 is unchanged ("set by conftest" still holds). |
| FIX | Usability | **The Done-when blocks fail on their second run, and build-unit always runs them twice.** 07, 14, 17 and 18 sign up fixed emails (`t@x.io`, `a14@x.io`, …). The executor runs Done-when, then build-unit's Verify step runs the same commands again. On the re-run, sign-up returns **422 `USER_ALREADY_EXISTS` with no `Set-Cookie`**, so every later `-b` request gets 401, not the expected 400/404/415/422/413/204. Verify then fails, retries and fails again (the DB is unchanged), and the prompt is marked `failed`, which halts its dependents. | build-unit SKILL.md §4 ("Run the prompt's Done-when commands"); better-auth 1.7.12: sign-up #1 → `200`, cookie set; sign-up #2 → `422`, cookie NONE; prompts/…-07:95, …-14:87–88, …-17:83–84, …-18:96; plan E2E :315, :319 | Make the emails unique per run: `R=$(date +%s%N)` at the top of each block, then `-d "{\"name\":\"A\",\"email\":\"a14-$R@x.io\",\"password\":\"password1\"}"`. Apply the same to the plan's E2E block. |
| FIX | Independence | **The lockfile is touched but not declared.** 07 (`better-auth`), 08 (`react-hook-form`, `@hookform/resolvers`, plus shadcn's deps) and 12 (`@vercel/blob`, `sharp`) all run `pnpm add`, which rewrites `apps/web/pnpm-lock.yaml`. None declares it. 12 also approves sharp's build scripts, which pnpm 10 may record in `pnpm-workspace.yaml`. build-unit's scope check flags every undeclared change as scope creep and stops to ask. | prompts/…-07:13, …-08:13, …-12:13 (`modify` lists); …-07:26, …-08:25, …-12:24–25 (`pnpm add`); build-unit SKILL.md §4 scope check | Add `apps/web/pnpm-lock.yaml` to `files.modify` in 07, 08 and 12, and `apps/web/pnpm-workspace.yaml` ("if pnpm writes build approvals there") in 12. |
| FIX | Usability | **07's secret check is a false pass, and the build then logs an auth error.** `.env.local` is copied from `.env.example`, so it holds `BETTER_AUTH_SECRET=      # openssl rand …`. `^BETTER_AUTH_SECRET=.\+` matches the padding and comment, so the "set it" hint never prints, even though the parsed value is `""`. In production mode, Better Auth then rejects with *"You are using the default secret"* when the module is imported. `next build` logs `[Error [BetterAuthError] …]` on every build from 07 on, though it exits 0. The executor may "fix" that by hard-coding a secret, which 07's own Do-not forbids. | Scratch: grep → "SET (false pass)"; `process.loadEnvFile` → `""`; better-auth 1.7.12 `NODE_ENV=production`: uncaught `BetterAuthError` at import; Next 16.4.3 `pnpm build`: error logged, exit 0; prompts/…-07:92 | 07 Done-when: `grep -qE '^BETTER_AUTH_SECRET=[^[:space:]#]' .env.local \|\| sed -i "s\|^BETTER_AUTH_SECRET=.*\|BETTER_AUTH_SECRET=$(openssl rand -base64 32)\|" .env.local` (writes it without printing it). Say in Context that editing the gitignored `.env.local` this way is allowed. |
| NOTE | Independence | 15's consent checkbox doesn't say native vs shadcn. Only `button` and `card` are listed as available, so an executor may run `shadcn add checkbox`, which adds a Radix dependency, `components/ui/checkbox.tsx` and a lockfile change, all outside its `files`. | prompts/…-15:27, :49–54, :12–13 | Say "a native `<input type="checkbox" required>`" in 15. |

**Checked and clean:**
- Better Auth 1.7.12 accepts sign-ups with no `Origin` header, and a 5-character password gets 400 `PASSWORD_TOO_SHORT`, so the curls in 07/14/17/18 work as written.
- Node's `process.loadEnvFile` strips inline `#` comments, so `drizzle.config.ts` gets clean URLs from the PLAN §8 `.env.example`.
- pnpm 10.33 forwards SIGTERM, so `kill %1` in 02/07/09 leaves no orphaned `next` (3 of 3 clean runs).
- The R14 consent field is sent by every success-path curl.
- The cron route fails closed.
- `depends_on` order is consistent (01→…→20, 19 after 18 and 06), and there are no parallel groups.
- The Prompts table matches the prompt frontmatter for every model.
- Every R1–R14 maps to a prompt and a check (E2E block, prompt Done-when, or M-step).

**Planner claims disproved:**
- "Every curl in the plan sends `-F consent=true`" holds, but the curls aren't re-runnable (finding 3).
- The proxy row in the Known-risks paragraph treats `proxy.ts` as harmless UX. Its `/login` rule is the one that loops (finding 1).

**Bloat estimate:** planned ~74 hand-written files (plus the scaffold) / ~3.25k LOC; minimal viable ~74 / ~3.2k.
The fixes add no files and remove ~3 lines from `proxy.ts`.
**Model cost:** unchanged and fit. 07 and 14 are on opus, justified. 06 is on haiku. The rest are sonnet.

### Applied 2026-10-23 (owner approved)
All 5 FIX findings and the NOTE are applied:
- 07: the proxy only redirects logged-out users from protected paths, and its matcher drops `/login` and `/register`.
- 01 and 05: conftest assigns `SCORER_API_KEY`, and the tests send `config.SCORER_API_KEY`.
- 07, 14, 17, 18 and the plan's E2E block: sign-up emails use a per-run suffix `R=$(date +%s%N)`.
- 07, 08 and 12: `apps/web/pnpm-lock.yaml` is declared, plus `pnpm-workspace.yaml` (conditional) in 12.
- 07: the secret check is `[^[:space:]#]`, and a missing secret is generated into `.env.local` without being printed.
- 15: the consent checkbox is a native `<input type="checkbox" required>`.

The plan's Decisions, Blast radius (4 new rows) and Log are updated. Every edited Done-when block passes `bash -n`.
The secret line was run twice in a scratch dir: it generated a 44-character secret, then kept it. Status stays
`audited`.
