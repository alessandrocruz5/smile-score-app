---
type: plan
kind: feature
status: audited
repo: smile-score-app
delivery: local
base:
sprint:
epic:
created: 2026-10-23
risk: medium
prompts: 20
graph_built: none
tags: [plan]
---
# Smile Score MVP: build PLAN.md end to end

## Request
> /plan-feature read @PLAN.md

The request is to plan the build described in `PLAN.md` (repo root, committed in `8462a13`, 549 lines). PLAN.md is the
spec: its stack is decided (§3), and any section marked **VERIFY** must be checked against current docs.
Its owner instruction says to build "one phase at a time", run each phase's "Done when" checks, then stop.

| # | Requirement | Source |
|---|---|---|
| R1 | Register, log in and log out with email + password (Better Auth, minimum 8 characters) | PLAN §1.2.1, §7.1 |
| R2 | View and edit profile details (name) | §1.2.2, §7.5 |
| R3 | A logged-in user uploads a JPEG, PNG or WebP. The browser downscales it, the server normalizes it with sharp, scores it, then stores it privately | §1.2.3, §2.1, §7.2 |
| R4 | The scorer detects one face and returns a 0–100 smile score, a breakdown, the raw blendshapes and an overlay | §1.2.4, §6 |
| R5 | The results page shows the photo with a face overlay, the score with its label, the breakdown bars and the date | §1.2.5, §7.5 |
| R6 | The history lists only the user's own uploads. Another user's upload ID returns 404 on both the results page and the image route | §1.2.6, §2.2 |
| R7 | Friendly errors for no face, multiple faces, unsupported file, file too large and scorer unavailable | §1.2.7, §7.6 |
| R8 | Every item in the security checklist holds | §12 |
| R9 | Deployed on Vercel, Render and Neon, and the production smoke test passes | §10 P0/P4, §13 |
| R10 | Vitest and pytest suites exist, and CI (lint, typecheck, test, ruff, pytest) is green | §10 P1/P4 |
| R11 | `README.md` (§15 outline) and `docs/DECISIONS.md` (§11, kept current) | §11, §15 |
| R12 | Calibration script, versioned formula constants (`formula_vN` in `model_version`) | §6.4 |
| R13 | A user can delete one of their own uploads. That removes the stored image and the row. Another user's ID returns 404 | Owner, 2026-10-23 (audit Open question 4) |
| R14 | Photo privacy: (A) consent is required before every upload and enforced by the server; (B) the scorer keeps images in memory only and never logs or echoes them; (C) all demo accounts and photos are deleted after the review period (M5); (E) uploads are purged automatically after 30 days | Owner, 2026-10-23 (privacy options A, B, C, E) |

## Context used
- Note: `PLAN.md` (the whole file): the spec, stack, phases, contracts, error copy and gotchas. It is the only
  project note.
- Note: `README.md`: a two-line stub. Prompt 20 replaces it.
- Profile: no `CLAUDE.md` in the repo or any folder above it, so there's no `## Commands`, no
  `## High-stakes paths` and no Jira key. Delivery is `local` and the plans live in `docs/plans`. The commands
  below come from PLAN §9 and §10 (see Open questions).
- Graph: none. The repo has one commit (`1d4aaa4`, README only), so there's nothing to graph yet.
- Vault: `$OBSIDIAN_VAULT` is unset and `~/Code/Obsidian Vault` doesn't exist, so the vault steps were skipped.
- Machine: node v26.12.0, pnpm, uv and docker are installed. `python3.12` isn't, so use
  `uv venv --python 3.12`. The clock read Fri 2026-10-23 21:21 (+08:00) at planning time.

## Decisions
- **The stack is exactly PLAN §3.** No library swaps. The only additions are tooling PLAN already implies:
  `requirements-dev.txt` (pytest, ruff, httpx for FastAPI's TestClient), `prettier` with
  `eslint-config-prettier`, and `vitest`.
- **Delivery is `local`:** no Jira key and no TASKS.md. The owner commits after each phase, so each phase's
  diff stays reviewable. PLAN.md is already committed (`8462a13`).
- **Phase gating follows PLAN §10.** The prompts are grouped into Phases 0–4. After each phase, run that
  phase's "Done when" and stop. The manual owner steps (M0–M4) sit between phases.
- **Tests ship with the code they cover,** not batched into Phase 4. Each prompt's tests come in that prompt,
  so every prompt is verifiable on its own and Monday's load shrinks. Phase 4 keeps CI and docs only. This
  reorders PLAN §10 P4 without changing its scope.
- **Docker, mediapipe and the model download move up to Phase 0** (prompt 01). The riskiest infra items
  (mediapipe wheel on 3.12, `libGL` on slim images, the model URL) then surface on the first Render deploy
  instead of in Phase 1.
- **mediapipe version (audit).** PyPI's latest is `1.1.1`, a new major (1.0.0 shipped 2026-07-27), and its Linux
  wheels are `py3-none-manylinux_2_28_x86_64`, not `cp312`. PLAN §6.2 was written for 0.10.x. Prompt 01 installs the
  latest and pins it exactly. Prompt 04 checks the API against the installed major. If 1.x moved the
  `FaceLandmarker` options or `FaceLandmarksConnections`, pin `mediapipe==0.10.35` (the last 0.10, with the same
  deps) instead of adapting to an undocumented API. DECISIONS #23 records which version was chosen.
- **Overlay contract: segments, not polylines.** MediaPipe's `FaceLandmarksConnections` are edge lists
  (start, end). Lips are two loops, so chaining edges into one ordered polyline is fiddly and error-prone.
  The scorer returns each feature as a list of segments `[x1, y1, x2, y2]` (normalized 0–1). `bbox` stays
  `[x, y, w, h]`. The SVG draws one `<path d="M x1 y1 L x2 y2 …">` per feature, with
  `vector-effect="non-scaling-stroke"`. This changes the PLAN §6.1 example, and DECISIONS.md records it as #16.
- **"File too large" happens on the client.** The client rejects a raw file over 25 MB with `too_large`
  before decoding it (decoding a huge image can crash a tab). A 20 MB phone photo is downscaled and
  succeeds. The server still enforces 4 MB after the multipart parse, and Vercel's own 413 (non-JSON) maps
  to `too_large` on the client.
- **The client doesn't pre-check the MIME type (audit).** PLAN keeps HEIC in scope on Safari (§1.3 rules out only
  "HEIC from non-Safari browsers"), and §7.2 rejects a file when decoding fails. So the upload form rejects on
  `DecodeError`, not on `file.type`. The browser always sends the downscaled JPEG, so the server allowlist is
  unaffected.
- **The type allowlist checks the real format, not the declared one (audit, R8).** The web checks
  `sharp(input).metadata().format ∈ {jpeg, png, webp}` in `normalizeImage`, and the scorer checks
  `img.format ∈ {JPEG, PNG, WEBP}` after `Image.open`. A client-declared `Content-Type` is never trusted on its own.
  DECISIONS #22.
- **There's one owner-scoped query module** (`src/lib/uploads.ts`): `getUploadForUser(id, userId)`,
  `listUploadsForUser(userId)` and `deleteUploadForUser(id, userId)`. Every read and delete of `uploads` goes
  through it, so the `user_id` filter (security checklist) lives in one place.
- **Delete an upload (R13, owner decision).** `DELETE /api/uploads/[id]` is a route handler, not a Server Action,
  so curl can verify it and it matches the rest of the upload API. The order is: owner check, then delete the
  **blob first**, then the row. If the blob delete fails, nothing has changed and the user gets an error. If the
  row delete fails afterwards, a retry is safe, because both `del` calls are idempotent. Doing it the other way
  round could leave a face photo stored with no row pointing to it, which is the worse failure for privacy.
  DECISIONS #21. Account deletion stays out of scope.
- **Consent is enforced on the server (R14 A).** The upload form has a required checkbox whose text states the
  retention period, and `POST /api/uploads` returns 400 `consent_required` unless `consent=true` is sent. A
  client-only checkbox can be bypassed with curl. With the server check, each row's `created_at` is its consent
  record, with no extra column. DECISIONS #24.
- **The scorer is in-memory only (R14 B).** It never writes the image itself, never logs bytes or decoder text, and
  error bodies hold only `error` (+ `face_count`). A test asserts this. Starlette may spool a part over 1 MB to a
  temp file that it deletes at the end of the request; the README says so rather than hiding it.
- **Retention: a 30-day purge (R14 E).** `PHOTO_RETENTION_DAYS = 30` lives in `validation.ts` as a constant, not an
  env var, so the consent text and the job can't disagree. A daily Vercel Cron job (`apps/web/vercel.json`, Hobby
  allows daily at most) calls `GET /api/cron/purge`. The route fails closed without `CRON_SECRET` and compares the
  bearer in constant time. `purgeExpiredUploads` is the **one documented cross-user query** in `uploads.ts`: it
  takes no user input and uses the same blob-first order as delete. At most 100 rows go per run; no index, because
  the volume is tiny. DECISIONS #25.
- **Demo data is wiped after the review (R14 C).** M5 deletes every account and photo once the review period
  ends, and the README promises it.
- **Non-UUID IDs return 404.** `z.uuid()` checks the `[id]` param before any query. Otherwise Postgres
  throws on the uuid cast and the route returns a 500, which leaks the shape of the IDs.
- **Images render with a plain `<img>`, not `next/image`.** The optimizer fetches the URL server-side
  without the user's cookies, so it would get a 404 and could cache a private image.
- **Session checks run on every page, not just the layout,** because layouts don't re-render on client
  navigation. The `(app)/layout.tsx` check is for UX. Each page, route handler and action calls
  `requireSession()` or `getSession()` itself (§7.1, CVE-2025-29927).
- **`proxy.ts` never redirects away from `/login` (re-audit).** It only sends logged-out users from protected
  paths to `/login`. A cookie-presence redirect from `/login` to `/dashboard` loops forever against
  `requireSession()` when the cookie's session is gone (DB reset, expiry, the M5 wipe).
- **Done-when blocks are re-runnable (re-audit).** build-unit runs each block twice (agent, then verify), and a
  repeat sign-up returns 422 with no cookie, so every sign-up email carries a per-run suffix `R=$(date +%s%N)`.
- **The scorer fails closed:** when `SCORER_API_KEY` is empty, every `/score` returns 401. The key check
  is a FastAPI dependency, so it runs before body validation.
- **New error code `upload_failed`** ("Something went wrong saving your photo. Please try again.") covers a
  failed storage or DB write. It traces to R7: no unfriendly 500s.
- **The storage adapter fails loudly, and lazily (audit):** `getStorage()` is memoized and throws on its
  **first call** if `process.env.VERCEL` is set and `BLOB_READ_WRITE_TOKEN` isn't, instead of silently writing to
  Vercel's read-only disk. It never throws at import: Vercel sets `VERCEL` at build time too, and `next build` loads
  route modules, so an import-time throw would fail the build.
- **The local adapter is `storage/local.ts`,** as in PLAN §4. Its exports are `createLocalDiskStorage` and
  `localDiskStorage`, which avoids confusion with the DOM `localStorage`.
- **No `user.additionalFields`:** the owner confirmed on 2026-10-23 that registration takes exactly name, email
  and password (PLAN §1.1). Better Auth's `user` table already has all three.
- **Node:** run locally on v26. Pin Vercel to the newest Node LTS it supports (VERIFY; likely `24.x`), and
  set `engines.node: ">=24"`.

**Non-goals:** OAuth, email verification, password reset, fake or AI-photo detection, HEIC outside Safari,
public sharing, an admin panel (PLAN §1.3); deleting the account; rate
limiting beyond Better Auth's built-in; thumbnails or resized variants; a job queue; Playwright (optional in
PLAN, skipped for schedule); committing `.env*` or the model file.

## Change list
Paths are relative to the repo root (`/home/apa/Code/smile-score-app`). PLAN §4 calls the root `smile-score/`;
here it's this repo.

| File | Action | Why | Req | Prompt |
|---|---|---|---|---|
| `.gitignore` | C | Ignore env files, venv, the model, `.data` and build output | R8 | 01 |
| `docker-compose.yml` | C | Local postgres:16 and the scorer | R9 | 01 |
| `apps/scorer/app/{__init__,main,config}.py` | C | FastAPI app, `/health`, env config | R4 | 01 |
| `apps/scorer/{requirements,requirements-dev}.txt`, `pyproject.toml` | C | Pinned deps, ruff and pytest config | R4, R10 | 01 |
| `apps/scorer/Dockerfile`, `scripts/download_model.sh`, `.env.example` | C | Image with libGL and the model; non-Docker model fetch | R4, R9 | 01 |
| `apps/scorer/tests/{__init__,conftest,test_health}.py` | C | Health test, test env | R10 | 01 |
| `apps/web/**` (create-next-app and shadcn output) | C | Next.js 16 skeleton | R9 | 02 |
| `apps/web/package.json`, `.gitignore`, `.env.example`, `.prettierrc`, `vitest.config.ts`, `drizzle.config.ts` | C/M | Scripts, env template, tooling | R9, R10 | 02 |
| `apps/web/src/lib/db/{index,schema}.ts`, `src/app/api/health/route.ts`, `src/app/page.tsx` | C | DB client, DB health check, placeholder home | R9 | 02 |
| `apps/scorer/app/scoring.py`, `config.py` (constants), `tests/test_scoring.py` | C/M | Formula v1, pure functions | R4, R12 | 03 |
| `apps/scorer/app/{landmarker,overlay}.py`, `main.py` (lifespan), `tests/test_overlay.py` | C/M | Load the model once, lock, extract segments | R4, R5 | 04 |
| `apps/scorer/app/schemas.py`, `main.py` (`/score`), `tests/test_api.py` | C/M | Endpoint, key check, format allowlist, error mapping, contract | R4, R7, R8 | 05 |
| `apps/scorer/scripts/calibrate.py` | C | Labels vs. predictions, MAE, mis-ordered pairs | R12 | 06 |
| `apps/web/src/lib/{auth,auth-client,session}.ts`, `src/app/api/auth/[...all]/route.ts`, `src/proxy.ts`, `src/lib/db/schema.ts`, `drizzle/0000_*` | C/M | Better Auth, sessions, redirects, auth tables | R1, R8 | 07 |
| `apps/web/src/lib/validation.ts`, `src/app/(auth)/{login,register}/page.tsx`, `tests/validation.test.ts` | C | Auth forms and schemas | R1 | 08 |
| `apps/web/src/app/(app)/{layout,dashboard/page}.tsx`, `src/components/sign-out-button.tsx`, `src/app/page.tsx`, `src/app/api/uploads/route.ts` (stub) | C/M | Protected shell, logout, 401 stub | R1, R8 | 09 |
| `apps/web/src/app/(app)/profile/{page.tsx,actions.ts}`, `src/components/profile-form.tsx`, `src/lib/validation.ts` | C/M | Profile edit | R2 | 10 |
| `apps/web/src/lib/db/schema.ts` (uploads), `drizzle/0001_*`, `src/lib/validation.ts` (scorer and error schemas), `tests/validation.test.ts` | M/C | Uploads table, the cross-service contract | R4, R6, R7 | 11 |
| `apps/web/src/lib/storage/{index,blob,local}.ts`, `src/lib/image.ts`, `tests/{storage,image}.test.ts` | C | Private storage (lazy `getStorage()`), sharp normalization with a real-format allowlist | R3, R8 | 12 |
| `apps/web/src/lib/scorer.ts`, `tests/scorer.test.ts` | C | Typed scorer client, error mapping | R4, R7 | 13 |
| `apps/web/src/lib/uploads.ts`, `src/app/api/uploads/route.ts`, `src/app/api/uploads/[id]/image/route.ts` | C/M | Upload flow, owner-checked image stream | R3, R6, R7, R8 | 14 |
| `apps/web/src/lib/downscale.ts`, `src/components/{upload-form,history-grid}.tsx`, `src/app/(app)/dashboard/page.tsx`, `tests/downscale.test.ts` | C/M | Client downscale, upload UI, history | R3, R6, R7 | 15 |
| `apps/web/src/lib/score-label.ts`, `src/components/{score-card,breakdown-bars,face-overlay}.tsx`, `src/app/(app)/results/[id]/page.tsx`, `tests/score-label.test.ts` | C | Results page | R5, R6 | 16 |
| `apps/web/src/lib/uploads.ts` (`deleteUploadForUser`), `src/app/api/uploads/[id]/route.ts`, `src/components/delete-upload-button.tsx`, `src/app/(app)/results/[id]/page.tsx` | M/C | Owner-checked delete: blob, then row | R13, R6, R8 | 17 |
| `apps/web/src/lib/{cron,uploads}.ts`, `src/app/api/cron/purge/route.ts`, `vercel.json`, `.env.example` (`CRON_SECRET`), `tests/cron.test.ts` | C/M | 30-day retention purge (Vercel Cron) | R14 | 18 |
| `.github/workflows/ci.yml` | C | Web and scorer CI jobs | R10 | 19 |
| `README.md`, `docs/DECISIONS.md` | M/C | Docs for reviewers | R11, R14 | 20 |

**Review constraints:** the profile defines none. PLAN's own hard rules stand in for them and are inlined into
the prompts: no new libraries, VERIFY items checked against the docs, `requireSession()` everywhere,
uploads through the route handler (not a Server Action), a private Blob store, the Tasks API only, a sync
`def` endpoint, and `hmac.compare_digest`.

## Blast radius
**Risk:** medium. The code is greenfield, so nothing existing can break. But it covers auth, sessions, an
IDOR-prone image route and face images (biometric-adjacent data), and the reviewers will probe exactly those.

| Affected | Kind | Via | Breaks? | Mitigation |
|---|---|---|---|---|
| `README.md` | Direct | Replaced in 20 | No, it's a stub | n/a |
| `PLAN.md` | Non-graph | Referenced by docs | No, committed in `8462a13` | n/a |
| Scorer JSON contract (PLAN §6.1) | Non-graph (HTTP) | `schemas.py` (05) ↔ `scorerResponseSchema` (11) ↔ `scorer.ts` (13) | A field-name drift fails zod and the user sees `scorer_unavailable` | Prompts 05 and 11 inline the identical contract. 13 tests a fixture with that shape. The E2E curl checks it live |
| Overlay shape (segments) | Non-graph (HTTP) | 04/05 → 11 → 16 | A deviation from §6.1 confuses reviewers | DECISIONS.md #16, README note |
| Error codes | Non-graph | Scorer (05) → `scorer.ts` (13) → API (14) → copy (11) → UI (15) | An unknown code shows the wrong message | One `uploadErrorCode` zod enum in `validation.ts`. Unknown codes map to `scorer_unavailable` |
| Env keys `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SCORER_URL`, `SCORER_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `MODEL_PATH`, `MAX_IMAGE_BYTES` | Non-graph | `.env.example` ↔ code ↔ docker-compose ↔ Render/Vercel settings | A missing key breaks prod silently | Both `.env.example` files list every key. The scorer fails closed without a key. **(audit)** Each key is set on Vercel *before* the push that first needs it (M2: auth; M3: scorer + Blob), not all at once in M3 |
| `VERCEL` system env at build time **(audit)** | Non-graph (platform) | `storage/index.ts` (12) | An import-time throw would fail `next build` on any push made before the Blob store is connected | `getStorage()` is memoized and throws on its first call, never at import |
| DB tables `user`, `session`, `account`, `verification`, `uploads` | Non-graph | `schema.ts` ↔ Better Auth adapter ↔ `drizzle/` ↔ Neon | A schema-to-migration mismatch, or prod running code ahead of its tables | Always `db:generate`, then `db:migrate`. Commit the migrations. **(audit)** Run `0000` on Neon in M2 and `0001` in M3, each before its push, with Neon's **direct** (unpooled) URL: `DATABASE_URL='<direct url>' pnpm db:migrate` (an explicit env var wins over `.env.local`; verified on Node 26) |
| `schema.ts` regeneration **(audit)** | Non-graph | Better Auth CLI `--output src/lib/db/schema.ts` (07) | Re-running the CLI after 11 overwrites `uploads` | 07 writes a header warning into `schema.ts` |
| Blob path `uploads/{userId}/{uuid}.jpg` | Non-graph | 14 writes it, the DB stores it, 14 reads it, 17 deletes it | n/a | Built only server-side. The local adapter rejects `..` |
| Delete order **(R13)** | Non-graph | 17: blob, then row | A blob without a row (unreachable face photo) or a row without a blob (broken thumbnail) | Blob first, then row; both `del`s are idempotent, so a retry completes it. A row left without its blob shows a 404 image until the retry |
| `on delete cascade` from user to uploads | Non-graph | DB | Deleting a user orphans their blobs | Unreachable, since there's no account deletion (non-goal). README lists it under Known limitations |
| Vercel 4.5 MB body limit, 1 MB Server Action limit | Non-graph (platform) | Upload path | 413 | Client downscale. A route handler, not an action. The client maps a non-JSON 413 to `too_large` |
| Content-declared vs real image type **(audit, R8)** | Non-graph | 12, 05 | A GIF/TIFF/SVG declared as `image/jpeg` would be accepted | sharp `metadata().format` and Pillow `img.format` allowlists |
| mediapipe 1.x major **(audit)** | Non-graph (dependency) | 01, 04 | PLAN's 0.10.x API notes may be stale | 04 verifies against the installed major and falls back to `mediapipe==0.10.35` |
| Upload contract: `consent` form field **(R14)** | Non-graph (HTTP) | 15 sends it, 14 requires it, the curl checks in 14/17/18 and E2E send it | A client or check without `consent=true` gets 400 `consent_required` | Every curl in the plan sends `-F consent=true`; 14 checks that the field-less request returns 400 |
| `CRON_SECRET` env key **(R14)** | Non-graph (config) | `.env.example` ↔ the cron route ↔ Vercel settings | Without it, the purge never runs (401), and photos outlive the promise | Fails closed by design. M3 sets it on Vercel and checks the Cron Jobs tab |
| Cross-user purge query **(R14)** | Non-graph | `purgeExpiredUploads` in `uploads.ts` | A flipped comparison would delete recent photos for every user | `retentionCutoff` unit tests (cutoff < now); 18's Done-when proves an aged row is purged **and** a recent one survives |
| Vercel Cron limits **(R14)** | Non-graph (platform) | `vercel.json` | Hobby is daily at most, only on production | Daily schedule; 18 VERIFYs the limits |
| Render 512 MB RAM | Non-graph (platform) | mediapipe + `opencv-contrib-python` + `matplotlib` | OOM on the instance | 05 records `docker stats` after a scored request |
| `BETTER_AUTH_URL` = prod domain | Non-graph (platform) | Vercel preview URLs | Sign-in fails Better Auth's origin check on previews | Smoke-test on the production domain only |
| Stale session cookie ↔ `proxy.ts` **(re-audit)** | Non-graph (cookies) | `proxy.ts` (07) ↔ `requireSession()` (07, 09) | A cookie-only `/login` → `/dashboard` redirect loops against the layout's `/dashboard` → `/login` | `proxy.ts` only redirects logged-out users from protected paths |
| `SCORER_API_KEY` in the Docker pytest **(re-audit)** | Non-graph (test env) | compose env ↔ `conftest.py` (01) ↔ `test_api.py` (05) | `setdefault` loses to the compose `dev-scorer-key`; hard-coded test keys get 401 | conftest assigns the key; tests send `config.SCORER_API_KEY` |
| Empty `BETTER_AUTH_SECRET` locally **(re-audit)** | Non-graph (config) | `.env.local` from `.env.example` ↔ Better Auth in production mode | `next build` logs a default-secret error (exit 0) | 07 generates a local secret into `.env.local`, unprinted |
| `pnpm-lock.yaml` **(re-audit)** | Non-graph (lockfile) | `pnpm add` in 07, 08, 12 | Undeclared change trips build-unit's scope check | Declared in those prompts' `files` |
| Render free-tier cold start | Non-graph (platform) | Scorer | Reviewers wait about 60 s | Starter instance in review week (M4). 30 s timeout → `scorer_unavailable` |

**Known risks in the touched area** (PLAN §14 and the new ones): `mediapipe.solutions` is gone, so use the Tasks
API. Blendshapes are off by default, and `num_faces` defaults to 1. Slim images lack libGL. `middleware.ts` is
now `proxy.ts` (with a `proxy` export). pnpm 10 blocks dependency build scripts, so approve the ones listed under
"Ignored build scripts". create-next-app's `.gitignore` has `.env*`, which also hides `.env.example`, so add
`!.env.example`. `drizzle-kit` doesn't read `.env.local` by itself, so `drizzle.config.ts` calls
`process.loadEnvFile`. Better Auth's `getSession` needs `await headers()` in server components. An SVG stroke
without `non-scaling-stroke` renders in viewBox units, so it comes out enormous.

**Compliance flag (CTO):** face photos plus landmark geometry plus blendshapes are biometric-adjacent personal
data (GDPR Art. 9, BIPA, and the PH Data Privacy Act's "sensitive personal information"). For a private take-home
the controls are proportionate: a private store, owner-checked reads, EXIF/GPS stripped, nothing stored when
scoring fails, and (R13) the user can delete any upload. **Expect a question on consent and retention.** R14
answers it: server-enforced consent (14, 15), an in-memory scorer (05), a 30-day purge (18), the demo wipe (M5),
and a README Privacy section and next steps (20). The remaining exposure is the stored landmark geometry; the README
names data minimization as the next step.

## Prompts
| # | Title | Phase | Model | Effort | Depends | Group | Files |
|---|---|---|---|---|---|---|---|
| 01 | Scorer skeleton, Docker, model download, root files | 0 | sonnet | medium | — | — | 13 small (scaffold) |
| 02 | Web skeleton: Next 16, shadcn, Drizzle client, health route | 0 | sonnet | medium | 01 | — | scaffold + 9 |
| 03 | Scoring formula v1 (pure) + tests | 1 | sonnet | medium | 01 | — | 3 |
| 04 | Landmarker (load once, lock) + overlay segments | 1 | sonnet | high | 03 | — | 5 |
| 05 | `POST /score`: key, limits, format allowlist, errors, schema + API tests | 1 | sonnet | high | 04 | — | 3 |
| 06 | `calibrate.py` | 1 | haiku | low | 05 | — | 1 |
| 07 | Better Auth server, sessions, `proxy.ts`, auth migration | 2 | **opus** | high | 02 | — | 7 |
| 08 | Login and register pages + auth schemas | 2 | sonnet | medium | 07 | — | 4 |
| 09 | Protected app shell, logout, root redirect, uploads 401 stub | 2 | sonnet | medium | 08 | — | 5 |
| 10 | Profile page + server action | 2 | sonnet | medium | 09 | — | 4 |
| 11 | `uploads` table + migration, scorer and error zod schemas | 3 | sonnet | medium | 10 | — | 4 |
| 12 | Storage adapters (private Blob and local disk, lazy `getStorage()`) + sharp normalization | 3 | sonnet | high | 11 | — | 6 |
| 13 | Scorer client + error-mapping tests | 3 | sonnet | medium | 11 | — | 2 |
| 14 | `POST /api/uploads` + owner-checked image route | 3 | **opus** | high | 05, 12, 13 | — | 3 |
| 15 | Client downscale, upload form, history grid, dashboard | 3 | sonnet | high | 14 | — | 5 |
| 16 | Results page: score card, breakdown, face overlay | 3 | sonnet | high | 15 | — | 6 |
| 17 | Delete an upload: owner-checked `DELETE /api/uploads/[id]` + button | 3 | sonnet | high | 16 | — | 4 |
| 18 | 30-day retention purge: Vercel Cron + secret-protected route | 3 | sonnet | high | 17 | — | 6 |
| 19 | GitHub Actions CI | 4 | sonnet | medium | 18, 06 | — | 1 |
| 20 | README + DECISIONS.md | 4 | sonnet | medium | 19 | — | 2 |

- **07 opus:** auth and sessions, with three VERIFY-heavy APIs (the Better Auth CLI, the Next 16 handler,
  `proxy.ts`), and the security defense in the Q&A rests on it.
- **14 opus:** the IDOR and authorization boundary, the score-before-store ordering with best-effort cleanup,
  and the request-size and type checks. A subtle bug here is the worst finding a reviewer could make.
- **Not opus:** 04's single `threading.Lock` is trivial concurrency, and its real risk is API drift, which
  sonnet with high effort and a VERIFY step handles. 05's key check is one `hmac.compare_digest` with an
  exact spec. 17 copies 14's owner-check pattern exactly (`getUploadForUser` → 404), and its only design choice
  (blob first, then row) is fixed in the prompt. 18 deletes across users, but its logic is one `lt` comparison
  plus 17's delete order. The risk (a flipped comparison) is caught by a unit test and by a Done-when that checks
  both an aged row and a recent one.
- **Parallelism:** none. **(audit)** 01 and 02 used to share group A, but 02's Done-when needs 01's
  `docker-compose.yml`, and both run `docker compose up` on the same project. Everything is sequential.

### Manual owner steps (not prompts)
- **M0, after 01 and 02 (Phase 0 "Done when"):** commit and push. Create the Neon project. Copy the **pooled** URL
  with `sslmode=require` for Vercel's `DATABASE_URL`, and keep the **direct** URL for migrations. Create a Render
  Docker web service (root `apps/scorer`, health check `/health`, env `SCORER_API_KEY`). Create a Vercel project
  (root `apps/web`, Node per the decision above, env `DATABASE_URL`). Check that the Vercel URL loads, Render
  `/health` returns ok, and Vercel `/api/health` returns `{"status":"ok"}`.
- **M1, before 05:** put your own photos in `apps/scorer/tests/fixtures/{neutral,small_smile,big_smile}.jpg`,
  then decide whether to commit them (see Open questions).
- **M2, after 10 (Phase 2 "Done when"):** walk through register, log in, edit the profile and log out in the
  browser. Commit. **(audit) Before pushing:** from `apps/web`, run `DATABASE_URL='<neon direct url>' pnpm db:migrate`
  (`0000`, the auth tables). Set `BETTER_AUTH_SECRET` (a new `openssl rand -base64 32`, not the local one) and
  `BETTER_AUTH_URL` (the production domain) on Vercel. Then push, and register and log in on the production domain.
- **M3, after 18 (Phase 3 "Done when"):** **(audit) Before pushing:** run `DATABASE_URL='<neon direct url>' pnpm
  db:migrate` (`0001`, `uploads`). Set `SCORER_URL`, `SCORER_API_KEY` (matching Render) and `CRON_SECRET`
  (`openssl rand -hex 32`) on Vercel. Create and
  connect a **private** Blob store (this adds `BLOB_READ_WRITE_TOKEN`). Then push. Hand-test on the production
  domain: no face, two faces, a `.txt` renamed `.jpg`, a 30 MB file, a 20 MB photo, a portrait phone photo,
  deleting an upload, an upload with the consent box unticked (the button stays disabled), and the cross-user 404.
  Check that the Vercel Cron Jobs tab lists `/api/cron/purge` daily. Calibrate with 30–50 photos in `tests/fixtures/calibration/`
  (`python scripts/calibrate.py`), then edit the constants in `config.py`, bump to `formula_v2`, and re-run
  pytest. Commit and push.
- **M4, after 20:** switch Render to Starter. Run the production smoke test (PLAN §13.4) on the production
  domain (not a preview URL). Check that a fresh clone works from the README alone. Submit Monday night.
- **M5, when the review period ends (R14 C):** delete every demo account and photo. Delete the Vercel Blob store
  (all images) and run `psql '<neon direct url>' -c 'truncate "user" cascade'` (users, sessions, accounts,
  uploads). Or simply delete the Neon project, the Blob store and the Render service. Keep the repo. If the demo
  must stay up for later hiring stages, do this when the process ends; the 30-day purge still runs in the
  meantime.

### Suggested schedule (today is Fri 2026-10-23, 21:21)
PLAN §10 put Phases 0–2 on Friday and left Saturday blank. Friday is gone, so: **Sat** Phases 0–2 (+M0, M2),
**Sun** Phase 3 (+M3; calibration is the long pole, so collect the photos Saturday), **Mon** Phase 4 (+M4),
submit. **Tue** buffer.

## End-to-end verification
No `## Commands` profile exists. These come from PLAN §9 and §10.
```bash
# web
cd apps/web && pnpm lint && pnpm typecheck && pnpm test && pnpm build
# scorer
cd apps/scorer && .venv/bin/ruff check . && .venv/bin/ruff format --check . && .venv/bin/pytest -q
# docker (pytest inside the image exercises a real detect())
docker compose up -d --build && curl -sf localhost:8000/health   # {"status":"ok","model_loaded":true}
docker compose run --rm -v "$PWD/apps/scorer/tests:/app/tests:ro" -v "$PWD/apps/scorer/pyproject.toml:/app/pyproject.toml:ro" scorer sh -c 'pip install -q pytest httpx && python -m pytest -q -rs'

# R4 / R7 / R8: the scorer contract and errors
curl -s -o /dev/null -w '%{http_code}\n' -F image=@smile.jpg localhost:8000/score                          # 401
curl -s -H 'X-Scorer-Key: dev-scorer-key' -F image=@smile.jpg localhost:8000/score | jq '.smile_score, .model_version'
curl -s -H 'X-Scorer-Key: dev-scorer-key' -F image=@README.md localhost:8000/score                          # 415 unsupported_image
curl -s -H 'X-Scorer-Key: dev-scorer-key' -F 'image=@x.gif;type=image/jpeg' localhost:8000/score            # 415 (format allowlist)

# R1, R3, R6, R13: web (pnpm dev running, cookie jars a.txt and b.txt for users A and B; R makes the emails unique per run)
R=$(date +%s%N)
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/uploads                                 # 401
curl -s -c a.txt -H 'Content-Type: application/json' -d "{\"name\":\"A\",\"email\":\"a-$R@x.io\",\"password\":\"password1\"}" localhost:3000/api/auth/sign-up/email
curl -s -b a.txt -F image=@smile.jpg localhost:3000/api/uploads                                             # 400 consent_required (R14)
curl -s -b a.txt -F image=@smile.jpg -F consent=true localhost:3000/api/uploads                             # {"id":"<uuid>"}
curl -s -b a.txt -F 'image=@x.gif;type=image/jpeg' -F consent=true localhost:3000/api/uploads               # 415 (format allowlist)
curl -s -c b.txt -H 'Content-Type: application/json' -d "{\"name\":\"B\",\"email\":\"b-$R@x.io\",\"password\":\"password1\"}" localhost:3000/api/auth/sign-up/email
curl -s -o /dev/null -w '%{http_code}\n' -b b.txt localhost:3000/api/uploads/<A's uuid>/image              # 404
curl -s -o /dev/null -w '%{http_code}\n' -b b.txt localhost:3000/api/uploads/not-a-uuid/image              # 404
curl -s -o /dev/null -w '%{http_code}\n' -b b.txt localhost:3000/results/<A's uuid>                        # 404
curl -s -o /dev/null -w '%{http_code}\n' -b b.txt -X DELETE localhost:3000/api/uploads/<A's uuid>          # 404 (R13)
exiftool <downloaded image> | grep -i gps                                                                  # no output (R8)
curl -s -o /dev/null -w '%{http_code}\n' -b a.txt -X DELETE localhost:3000/api/uploads/<A's uuid>          # 204 (R13)
curl -s -o /dev/null -w '%{http_code}\n' -b a.txt localhost:3000/api/uploads/<A's uuid>/image              # 404: gone
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/api/cron/purge                                     # 401 (R14; the aged-row check is in prompt 18)
```
R2, R5, R7 and R14 A (UI copy, checkbox): the M2 and M3 browser walkthroughs. R14 B: 05's privacy test. R14 C: M5. R9: M0, M2, M3 and M4. R10: CI green on the pushed
`main`. R11: a fresh clone runs from the README alone.

## Rollback
`local` delivery: each phase is one commit by the owner, so `git revert <phase commit>`. The DB in dev is
`docker compose down -v`. On Neon, the migrations only add new tables, so dropping them or resetting the branch is
safe before submission. Render and Vercel redeploy the previous commit from their dashboards.

## Open questions
1. **Commands:** the repo has no `CLAUDE.md` profile, so the commands above come from PLAN. Should they become a
   repo `CLAUDE.md` (`## Commands`, `## High-stakes paths: apps/web/src/lib/{auth,session}.ts,
   apps/web/src/app/api/**, apps/web/src/proxy.ts, apps/web/drizzle/**`)?
2. ~~PLAN §1.1 registration fields~~ **Resolved 2026-10-23:** exactly name, email, password (owner).
3. **Fixtures:** should your face photos be committed (CI then runs the ordering test), or kept local, with the
   ordering test skipping when they're missing? It doesn't change any prompt until M1: the tests skip either way.
4. ~~Delete an upload~~ **Resolved 2026-10-23:** yes, as prompt 17 (R13).
5. **Overlay as segments** instead of the polylines in PLAN §6.1: OK?

## Log
- 2026-10-23: planned (draft)
- 2026-10-23: audited (PASS-WITH-CHANGES), 10 fixes and 7 notes applied; owner added R13 (delete an upload, new
  prompt 17; CI and docs renumbered to 18 and 19) and confirmed the default registration fields
- 2026-10-23: owner added R14 (photo privacy A, B, C, E): server-enforced consent (11, 14, 15), an in-memory scorer
  (05), new prompt 18 (30-day retention purge), M5 (demo wipe); CI and docs renumbered to 19 and 20
- 2026-10-23: re-audited (PASS-WITH-CHANGES), 5 fixes and 1 note applied: proxy redirect loop (07), Docker test
  key (01, 05), re-runnable Done-when emails (07, 14, 17, 18, E2E), lockfile declared (07, 08, 12), local secret
  check (07), native consent checkbox (15)
