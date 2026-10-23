---
type: plan
kind: feature
status: draft
repo: smile-score-app
delivery: local
base:
sprint:
epic:
created: 2026-10-23
risk: medium
prompts: 18
graph_built: none
tags: [plan]
---
# Smile Score MVP: build PLAN.md end to end

## Request
> /plan-feature read @PLAN.md

The request is to plan the build described in `PLAN.md` (repo root, untracked, 549 lines). PLAN.md is the
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

## Context used
- Note: `PLAN.md` (the whole file): the spec, stack, phases, contracts, error copy and gotchas. It is the only
  project note.
- Note: `README.md`: a two-line stub. Prompt 18 replaces it.
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
  diff stays reviewable. **Commit PLAN.md before prompt 01.**
- **Phase gating follows PLAN §10.** The prompts are grouped into Phases 0–4. After each phase, run that
  phase's "Done when" and stop. The manual owner steps (M0–M4) sit between phases.
- **Tests ship with the code they cover,** not batched into Phase 4. Each prompt's tests come in that prompt,
  so every prompt is verifiable on its own and Monday's load shrinks. Phase 4 keeps CI and docs only. This
  reorders PLAN §10 P4 without changing its scope.
- **Docker, mediapipe and the model download move up to Phase 0** (prompt 01). The riskiest infra items
  (mediapipe wheel on 3.12, `libGL` on slim images, the model URL) then surface on the first Render deploy
  instead of in Phase 1.
- **Overlay contract: segments, not polylines.** MediaPipe's `FaceLandmarksConnections` are edge lists
  (start, end). Lips are two loops, so chaining edges into one ordered polyline is fiddly and error-prone.
  The scorer returns each feature as a list of segments `[x1, y1, x2, y2]` (normalized 0–1). `bbox` stays
  `[x, y, w, h]`. The SVG draws one `<path d="M x1 y1 L x2 y2 …">` per feature, with
  `vector-effect="non-scaling-stroke"`. This changes the PLAN §6.1 example, and DECISIONS.md records it as #16.
- **"File too large" happens on the client.** The client rejects a raw file over 25 MB with `too_large`
  before decoding it (decoding a huge image can crash a tab). A 20 MB phone photo is downscaled and
  succeeds. The server still enforces 4 MB after the multipart parse, and Vercel's own 413 (non-JSON) maps
  to `too_large` on the client.
- **There's one owner-scoped query module** (`src/lib/uploads.ts`): `getUploadForUser(id, userId)` and
  `listUploadsForUser(userId)`. Every read of `uploads` goes through it, so the `user_id` filter
  (security checklist) lives in one place.
- **Non-UUID IDs return 404.** `z.uuid()` checks the `[id]` param before any query. Otherwise Postgres
  throws on the uuid cast and the route returns a 500, which leaks the shape of the IDs.
- **Images render with a plain `<img>`, not `next/image`.** The optimizer fetches the URL server-side
  without the user's cookies, so it would get a 404 and could cache a private image.
- **Session checks run on every page, not just the layout,** because layouts don't re-render on client
  navigation. The `(app)/layout.tsx` check is for UX. Each page, route handler and action calls
  `requireSession()` or `getSession()` itself (§7.1, CVE-2025-29927).
- **The scorer fails closed:** when `SCORER_API_KEY` is empty, every `/score` returns 401. The key check
  is a FastAPI dependency, so it runs before body validation.
- **New error code `upload_failed`** ("Something went wrong saving your photo. Please try again.") covers a
  failed storage or DB write. It traces to R7: no unfriendly 500s.
- **The storage adapter fails loudly:** if `process.env.VERCEL` is set and `BLOB_READ_WRITE_TOKEN` isn't,
  `storage/index.ts` throws instead of silently writing to Vercel's read-only disk.
- **No `user.additionalFields`:** PLAN §1.1 is blank, so the defaults (name, email, password) apply, and
  Better Auth's `user` table already has all three. **Flag this in the Phase 2 summary.**
- **Node:** run locally on v26. Pin Vercel to the newest Node LTS it supports (VERIFY; likely `24.x`), and
  set `engines.node: ">=24"`.

**Non-goals:** OAuth, email verification, password reset, fake or AI-photo detection, HEIC outside Safari,
public sharing, an admin panel (PLAN §1.3); deleting an upload or the account (see Open questions); rate
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
| `apps/scorer/app/schemas.py`, `main.py` (`/score`), `tests/test_api.py` | C/M | Endpoint, key check, error mapping, contract | R4, R7, R8 | 05 |
| `apps/scorer/scripts/calibrate.py` | C | Labels vs. predictions, MAE, mis-ordered pairs | R12 | 06 |
| `apps/web/src/lib/{auth,auth-client,session}.ts`, `src/app/api/auth/[...all]/route.ts`, `src/proxy.ts`, `src/lib/db/schema.ts`, `drizzle/0000_*` | C/M | Better Auth, sessions, redirects, auth tables | R1, R8 | 07 |
| `apps/web/src/lib/validation.ts`, `src/app/(auth)/{login,register}/page.tsx`, `tests/validation.test.ts` | C | Auth forms and schemas | R1 | 08 |
| `apps/web/src/app/(app)/{layout,dashboard/page}.tsx`, `src/components/sign-out-button.tsx`, `src/app/page.tsx`, `src/app/api/uploads/route.ts` (stub) | C/M | Protected shell, logout, 401 stub | R1, R8 | 09 |
| `apps/web/src/app/(app)/profile/{page.tsx,actions.ts}`, `src/components/profile-form.tsx`, `src/lib/validation.ts` | C/M | Profile edit | R2 | 10 |
| `apps/web/src/lib/db/schema.ts` (uploads), `drizzle/0001_*`, `src/lib/validation.ts` (scorer and error schemas), `tests/validation.test.ts` | M/C | Uploads table, the cross-service contract | R4, R6, R7 | 11 |
| `apps/web/src/lib/storage/{index,blob,disk}.ts`, `src/lib/image.ts`, `tests/{storage,image}.test.ts` | C | Private storage, sharp normalization | R3, R8 | 12 |
| `apps/web/src/lib/scorer.ts`, `tests/scorer.test.ts` | C | Typed scorer client, error mapping | R4, R7 | 13 |
| `apps/web/src/lib/uploads.ts`, `src/app/api/uploads/route.ts`, `src/app/api/uploads/[id]/image/route.ts` | C/M | Upload flow, owner-checked image stream | R3, R6, R7, R8 | 14 |
| `apps/web/src/lib/downscale.ts`, `src/components/{upload-form,history-grid}.tsx`, `src/app/(app)/dashboard/page.tsx`, `tests/downscale.test.ts` | C/M | Client downscale, upload UI, history | R3, R6, R7 | 15 |
| `apps/web/src/lib/score-label.ts`, `src/components/{score-card,breakdown-bars,face-overlay}.tsx`, `src/app/(app)/results/[id]/page.tsx`, `tests/score-label.test.ts` | C | Results page | R5, R6 | 16 |
| `.github/workflows/ci.yml` | C | Web and scorer CI jobs | R10 | 17 |
| `README.md`, `docs/DECISIONS.md` | M/C | Docs for reviewers | R11 | 18 |

**Review constraints:** the profile defines none. PLAN's own hard rules stand in for them and are inlined into
the prompts: no new libraries, VERIFY items checked against the docs, `requireSession()` everywhere,
uploads through the route handler (not a Server Action), a private Blob store, the Tasks API only, a sync
`def` endpoint, and `hmac.compare_digest`.

## Blast radius
**Risk:** medium. The code is greenfield, so nothing existing can break. But it covers auth, sessions, an
IDOR-prone image route and face images (biometric-adjacent data), and the reviewers will probe exactly those.

| Affected | Kind | Via | Breaks? | Mitigation |
|---|---|---|---|---|
| `README.md` | Direct | Replaced in 18 | No, it's a stub | n/a |
| `PLAN.md` (untracked) | Non-graph | Referenced by docs | Lost if never committed | Commit it before prompt 01 |
| Scorer JSON contract (PLAN §6.1) | Non-graph (HTTP) | `schemas.py` (05) ↔ `scorerResponseSchema` (11) ↔ `scorer.ts` (13) | A field-name drift fails zod and the user sees `scorer_unavailable` | Prompts 05 and 11 inline the identical contract. 13 tests a fixture with that shape. The E2E curl checks it live |
| Overlay shape (segments) | Non-graph (HTTP) | 04/05 → 11 → 16 | A deviation from §6.1 confuses reviewers | DECISIONS.md #16, README note |
| Error codes | Non-graph | Scorer (05) → `scorer.ts` (13) → API (14) → copy (11) → UI (15) | An unknown code shows the wrong message | One `uploadErrorCode` zod enum in `validation.ts`. Unknown codes map to `scorer_unavailable` |
| Env keys `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SCORER_URL`, `SCORER_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `MODEL_PATH`, `MAX_IMAGE_BYTES` | Non-graph | `.env.example` ↔ code ↔ docker-compose ↔ Render/Vercel settings | A missing key breaks prod silently | Both `.env.example` files list every key. The storage adapter throws on Vercel without a token. The scorer fails closed without a key |
| DB tables `user`, `session`, `account`, `verification`, `uploads` | Non-graph | `schema.ts` ↔ Better Auth adapter ↔ `drizzle/` ↔ Neon | A schema-to-migration mismatch | Always `db:generate`, then `db:migrate`. Commit the migrations. Run them on Neon in M3 |
| Blob path `uploads/{userId}/{uuid}.jpg` | Non-graph | 14 writes it, the DB stores it, 14 reads it | n/a | Built only server-side. The disk adapter rejects `..` |
| `on delete cascade` from user to uploads | Non-graph | DB | Deleting a user orphans their blobs | Unreachable, since there's no account deletion (non-goal). README lists it under Known limitations |
| Vercel 4.5 MB body limit, 1 MB Server Action limit | Non-graph (platform) | Upload path | 413 | Client downscale. A route handler, not an action. The client maps a non-JSON 413 to `too_large` |
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
scoring fails. **But expect a question on consent and retention.** Cheap mitigations: one consent line under the
upload button ("Your photo is stored privately and used only to compute your score"), plus a README "Privacy"
paragraph (prompts 15 and 18 include both). "Delete an upload" is the strongest answer and costs about one
prompt; see Open questions.

## Prompts
| # | Title | Phase | Model | Effort | Depends | Group | Files |
|---|---|---|---|---|---|---|---|
| 01 | Scorer skeleton, Docker, model download, root files | 0 | sonnet | medium | — | A | 13 small (scaffold) |
| 02 | Web skeleton: Next 16, shadcn, Drizzle client, health route | 0 | sonnet | medium | — | A | scaffold + 9 |
| 03 | Scoring formula v1 (pure) + tests | 1 | sonnet | medium | 01 | — | 3 |
| 04 | Landmarker (load once, lock) + overlay segments | 1 | sonnet | high | 03 | — | 4 |
| 05 | `POST /score`: key, limits, errors, schema + API tests | 1 | sonnet | high | 04 | — | 3 |
| 06 | `calibrate.py` | 1 | haiku | low | 05 | — | 1 |
| 07 | Better Auth server, sessions, `proxy.ts`, auth migration | 2 | **opus** | high | 02 | — | 7 |
| 08 | Login and register pages + auth schemas | 2 | sonnet | medium | 07 | — | 4 |
| 09 | Protected app shell, logout, root redirect, uploads 401 stub | 2 | sonnet | medium | 08 | — | 5 |
| 10 | Profile page + server action | 2 | sonnet | medium | 09 | — | 4 |
| 11 | `uploads` table + migration, scorer and error zod schemas | 3 | sonnet | medium | 10 | — | 4 |
| 12 | Storage adapters (private Blob and disk) + sharp normalization | 3 | sonnet | high | 11 | — | 6 |
| 13 | Scorer client + error-mapping tests | 3 | sonnet | medium | 11 | — | 2 |
| 14 | `POST /api/uploads` + owner-checked image route | 3 | **opus** | high | 05, 12, 13 | — | 3 |
| 15 | Client downscale, upload form, history grid, dashboard | 3 | sonnet | high | 14 | — | 5 |
| 16 | Results page: score card, breakdown, face overlay | 3 | sonnet | high | 15 | — | 6 |
| 17 | GitHub Actions CI | 4 | sonnet | medium | 16, 06 | — | 1 |
| 18 | README + DECISIONS.md | 4 | sonnet | medium | 17 | — | 2 |

- **07 opus:** auth and sessions, with three VERIFY-heavy APIs (the Better Auth CLI, the Next 16 handler,
  `proxy.ts`), and the security defense in the Q&A rests on it.
- **14 opus:** the IDOR and authorization boundary, the score-before-store ordering with best-effort cleanup,
  and the request-size and type checks. A subtle bug here is the worst finding a reviewer could make.
- **Not opus:** 04's single `threading.Lock` is trivial concurrency, and its real risk is API drift, which
  sonnet with high effort and a VERIFY step handles. 05's key check is one `hmac.compare_digest` with an
  exact spec.
- **Parallelism:** only 01 ∥ 02 (separate languages, directories and lockfiles). Everything else is
  sequential within its phase. The scorer and web tracks could interleave, but PLAN asks for phase-by-phase.

### Manual owner steps (not prompts)
- **M0, after 01 and 02 (Phase 0 "Done when"):** commit. Create the Neon project and copy the pooled URL with
  `sslmode=require`. Create a Render Docker web service (root `apps/scorer`, health check `/health`, env
  `SCORER_API_KEY`). Create a Vercel project (root `apps/web`, Node per the decision above, env
  `DATABASE_URL`). Check that the Vercel URL loads, Render `/health` returns ok, and Vercel `/api/health`
  returns `{"status":"ok"}`.
- **M1, before 05:** put your own photos in `apps/scorer/tests/fixtures/{neutral,small_smile,big_smile}.jpg`,
  then decide whether to commit them (see Open questions).
- **M2, after 10 (Phase 2 "Done when"):** walk through register, log in, edit the profile and log out in the
  browser. Commit.
- **M3, after 16 (Phase 3 "Done when"):** run `pnpm db:migrate` against Neon. Set the Vercel env vars
  (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SCORER_URL`, `SCORER_API_KEY`). Create and connect a **private**
  Blob store. Hand-test the edge cases: no face, two faces, a `.txt` renamed `.jpg`, a 30 MB file, a 20 MB
  photo, a portrait phone photo. Run the cross-user 404 check. Calibrate with 30–50 photos in
  `tests/fixtures/calibration/` (`python scripts/calibrate.py`), then edit the constants in `config.py`, bump
  `formula_v2`, and re-run pytest. Commit.
- **M4, after 18:** switch Render to Starter. Run the production smoke test (PLAN §13.4). Check that a fresh
  clone works from the README alone. Submit Monday night.

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
# docker
docker compose up -d --build && curl -sf localhost:8000/health   # {"status":"ok","model_loaded":true}

# R4 / R7: the scorer contract and errors
curl -s -o /dev/null -w '%{http_code}\n' -F image=@smile.jpg localhost:8000/score                          # 401
curl -s -H 'X-Scorer-Key: dev-scorer-key' -F image=@smile.jpg localhost:8000/score | jq '.smile_score, .model_version'
curl -s -H 'X-Scorer-Key: dev-scorer-key' -F image=@README.md localhost:8000/score                          # 415 unsupported_image

# R1, R3, R6: web (pnpm dev running, cookie jars a.txt and b.txt for users A and B)
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/uploads                                 # 401
curl -s -c a.txt -H 'Content-Type: application/json' -d '{"name":"A","email":"a@x.io","password":"password1"}' localhost:3000/api/auth/sign-up/email
curl -s -b a.txt -F image=@smile.jpg localhost:3000/api/uploads                                             # {"id":"<uuid>"}
curl -s -c b.txt -H 'Content-Type: application/json' -d '{"name":"B","email":"b@x.io","password":"password1"}' localhost:3000/api/auth/sign-up/email
curl -s -o /dev/null -w '%{http_code}\n' -b b.txt localhost:3000/api/uploads/<A's uuid>/image              # 404
curl -s -o /dev/null -w '%{http_code}\n' -b b.txt localhost:3000/api/uploads/not-a-uuid/image              # 404
curl -s -o /dev/null -w '%{http_code}\n' -b b.txt localhost:3000/results/<A's uuid>                        # 404
exiftool <downloaded image> | grep -i gps                                                                  # no output (R8)
```
R2, R5 and R7 (UI copy): the M2 and M3 browser walkthroughs. R9: M0 and M4. R10: CI green on the pushed
`main`. R11: a fresh clone runs from the README alone.

## Rollback
`local` delivery: each phase is one commit by the owner, so `git revert <phase commit>`. The DB in dev is
`docker compose down -v`. On Neon, the migrations only add new tables, so dropping them or resetting the branch is
safe before submission. Render and Vercel redeploy the previous commit from their dashboards.

## Open questions
1. **Commands:** the repo has no `CLAUDE.md` profile, so the commands above come from PLAN. Should they become a
   repo `CLAUDE.md` (`## Commands`, `## High-stakes paths: apps/web/src/lib/{auth,session}.ts,
   apps/web/src/app/api/**, apps/web/src/proxy.ts, apps/web/drizzle/**`)?
2. **PLAN §1.1 is blank:** are there brief-required fields or features beyond the defaults? An extra
   registration field changes 07, 08 and 10.
3. **Fixtures:** should your face photos be committed (CI then runs the ordering test), or kept local, with the
   ordering test skipping when they're missing?
4. **Delete an upload** (blob + row, owner-checked): add it as one extra prompt after 16? It's cheap and the
   strongest compliance answer in the Q&A.
5. **Overlay as segments** instead of the polylines in PLAN §6.1: OK?

## Log
- 2026-10-23: planned (draft)
