# Smile Score: Build Plan

> **For Claude Code:** Read this whole file before writing any code. Build **one phase at a time** (see §10). After each phase, run that phase's "Done when" checks, then stop and summarize what was built and what's next. The stack is decided, so don't swap libraries or add new ones without asking. Anything marked **VERIFY** must be checked against current official docs before you implement it, because those APIs changed recently. Keep the code small, explicit and readable. The owner has to defend every file in a live Q&A, so avoid clever abstractions.

---

## 0. Context

- Take-home project for a job application. Not public-facing.
- Submission due **Tuesday** (exact time to be confirmed). Reviewers study it for a few hours, then a **Q&A/defense on Wednesday**.
- AI-assisted coding is allowed. The owner must still be able to explain every decision, so §11 (Decision Record) is copied into `docs/DECISIONS.md`.
- Target: submit **Monday night**. Tuesday is buffer only.

---

## 1. Requirements

### 1.1 From the brief (owner fills this in before Phase 2)

- [ ] Required registration fields: `_____` *(default if blank: name, email, password)*
- [ ] Required features beyond register / upload / AI smile score: `_____`
- [ ] Submission format (repo link, live URL, or both): `_____`
- [ ] Deadline time and time zone: `_____`

If this section is still blank when Phase 2 starts, use the defaults and flag it in the phase summary.

### 1.2 Functional requirements

1. A user can register, log in, and log out.
2. A user can view and edit their profile details.
3. A logged-in user can upload a photo (JPEG, PNG or WebP).
4. The system detects the face and returns a **smile score from 0 to 100** with a breakdown.
5. The results page shows the photo with a face overlay, the score, and the breakdown.
6. A user sees a history of their own uploads and can never access anyone else's.
7. Clear, friendly errors for: no face, multiple faces, unsupported file, file too large.

### 1.3 Non-goals (list these in the README under "Known limitations")

- OAuth, email verification, password reset
- Detecting fake, stock or AI-generated photos (the app isn't public, so there's no abuse incentive)
- HEIC uploads from non-Safari browsers
- Public sharing, admin panel

---

## 2. Architecture

```mermaid
flowchart LR
  B[Browser] -->|"1. downscaled photo (multipart)"| W[Next.js app on Vercel]
  W -->|"2. normalize with sharp"| W
  W -->|"3. POST /score + X-Scorer-Key"| S[FastAPI scorer on Render]
  S -->|"4. score, breakdown, overlay"| W
  W -->|"5. put (private)"| BL[(Vercel Blob, private store)]
  W -->|"6. insert row"| DB[(Neon Postgres)]
  B -->|"view image"| W
  W -->|"owner check, then stream"| BL
```

### 2.1 Upload flow (the core of the app)

1. **Browser** shrinks the photo to a maximum of 1600px on its longest side and re-encodes it as JPEG (quality 0.9). This keeps the request under Vercel's 4.5 MB function body limit.
2. **`POST /api/uploads`** (a Route Handler, **not** a Server Action, because Server Actions have a 1 MB default body limit):
   1. Check the session. Return 401 if there isn't one.
   2. Check file type is in the allowlist and size is ≤ 4 MB. Return 415 or 413 otherwise.
   3. Run `sharp`: auto-rotate from EXIF, resize to fit inside 1600×1600 without enlarging, re-encode to JPEG at quality 88. Re-encoding strips all metadata, including GPS. If sharp throws, return 415.
   4. Send the normalized JPEG to the scorer (30 s timeout). If the scorer returns 422, pass a friendly error to the client and **store nothing**.
   5. Store the image in Blob at `uploads/{userId}/{uuid}.jpg`.
   6. Insert the `uploads` row. If the insert fails, delete the blob (best effort).
   7. Return `{ id }`. The client navigates to `/results/{id}`.
3. Scoring happens **before** storage, so failed scores never leave orphaned files behind.

### 2.2 Viewing an image

`GET /api/uploads/[id]/image`:
- Check the session.
- Look up the row by **both** `id` and `user_id`.
- If it isn't found, return **404, not 403**, so the response doesn't reveal that the ID exists.
- Stream the image from storage with `Content-Type: image/jpeg` and `Cache-Control: private, no-cache`.

---

## 3. Stack (decided)

| Concern | Choice | Notes |
|---|---|---|
| Web framework | Next.js 16, App Router, TypeScript | Reviewers' stated preference |
| Package manager | pnpm | Use the current Node LTS |
| Auth | Better Auth (email + password) | Sessions stored in our Postgres |
| ORM / migrations | Drizzle ORM + drizzle-kit | |
| DB driver | `pg` (node-postgres) via `drizzle-orm/node-postgres` | The same driver works with local Docker Postgres and with Neon's pooled URL |
| Database | Neon Postgres (free plan) | Local dev uses `postgres:16` in Docker |
| Validation | zod | One set of schemas for forms, route handlers, and the scorer response |
| Forms | react-hook-form + `@hookform/resolvers/zod` | |
| UI | Tailwind + shadcn/ui | |
| Image processing (web) | sharp | |
| Image storage | `@vercel/blob` ≥ 2.3, **private** store | Local filesystem adapter in dev |
| Scorer | Python 3.12, FastAPI + uvicorn | Endpoints defined with sync `def` |
| Face model | `mediapipe` Face Landmarker (**Tasks API only**) | Blendshapes enabled |
| Scorer helpers | Pillow, numpy, python-multipart | |
| Tests | Vitest (web), pytest (scorer), Playwright optional (one happy path) | |
| Lint / format | ESLint + Prettier (web), ruff (scorer) | |
| Hosting | Vercel (web), Render Docker web service (scorer), Neon (DB) | |
| CI | GitHub Actions | |

---

## 4. Repo layout

```
smile-score/
├── PLAN.md                      # this file
├── README.md
├── docs/
│   └── DECISIONS.md             # copied from §11, kept up to date
├── docker-compose.yml           # local: postgres + scorer
├── .github/workflows/ci.yml
├── apps/
│   ├── web/                     # Next.js
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── page.tsx                     # redirect to /dashboard or /login
│   │   │   │   ├── (auth)/login/page.tsx
│   │   │   │   ├── (auth)/register/page.tsx
│   │   │   │   ├── (app)/layout.tsx             # server-side session check, redirect if none
│   │   │   │   ├── (app)/dashboard/page.tsx     # upload form + history
│   │   │   │   ├── (app)/results/[id]/page.tsx  # score, breakdown, overlay
│   │   │   │   ├── (app)/profile/page.tsx
│   │   │   │   └── api/
│   │   │   │       ├── auth/[...all]/route.ts   # Better Auth handler
│   │   │   │       ├── health/route.ts          # runs `select 1` against the DB
│   │   │   │       └── uploads/
│   │   │   │           ├── route.ts             # POST: upload + score
│   │   │   │           └── [id]/image/route.ts  # GET: owner-checked image stream
│   │   │   ├── components/
│   │   │   │   ├── upload-form.tsx              # client: preview, downscale, submit
│   │   │   │   ├── score-card.tsx
│   │   │   │   ├── breakdown-bars.tsx
│   │   │   │   ├── face-overlay.tsx             # SVG over the image
│   │   │   │   └── history-grid.tsx
│   │   │   ├── lib/
│   │   │   │   ├── auth.ts                      # Better Auth server instance
│   │   │   │   ├── auth-client.ts
│   │   │   │   ├── session.ts                   # requireSession() helper
│   │   │   │   ├── db/index.ts
│   │   │   │   ├── db/schema.ts
│   │   │   │   ├── storage/index.ts             # picks blob or local adapter
│   │   │   │   ├── storage/blob.ts
│   │   │   │   ├── storage/local.ts
│   │   │   │   ├── scorer.ts                    # typed client, validates response with zod
│   │   │   │   ├── image.ts                     # sharp normalization
│   │   │   │   ├── downscale.ts                 # client-side canvas downscale
│   │   │   │   └── validation.ts                # zod schemas
│   │   │   └── proxy.ts                         # Next 16: optimistic redirects only
│   │   ├── drizzle/                             # generated migrations
│   │   ├── drizzle.config.ts
│   │   ├── tests/
│   │   └── .env.example
│   └── scorer/                  # FastAPI
│       ├── app/
│       │   ├── main.py          # routes, key check, error mapping
│       │   ├── landmarker.py    # loads model once, lock around detect()
│       │   ├── scoring.py       # pure functions: blendshapes -> score
│       │   ├── overlay.py       # extract lips/eyes/oval polylines and bbox
│       │   ├── config.py        # env + scoring constants
│       │   └── schemas.py       # Pydantic response models
│       ├── scripts/
│       │   ├── download_model.sh
│       │   └── calibrate.py
│       ├── tests/
│       │   ├── fixtures/        # owner's own photos only
│       │   └── test_*.py
│       ├── Dockerfile
│       ├── requirements.txt     # pinned
│       └── .env.example
```

---

## 5. Data model

### 5.1 Auth tables

Generate the `user`, `session`, `account` and `verification` tables with Better Auth's schema generator for the Drizzle adapter (**VERIFY** the current CLI command). If §1.1 lists extra registration fields, add them using Better Auth's `user.additionalFields` (**VERIFY** the syntax) so they live on the `user` row.

### 5.2 `uploads`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, primary key | |
| `user_id` | text, foreign key → `user.id`, `on delete cascade` | indexed |
| `blob_pathname` | text | `uploads/{userId}/{uuid}.jpg` |
| `width`, `height` | integer | after normalization |
| `smile_score` | integer (0–100) | |
| `components` | jsonb | `{ mouth_smile, eye_crinkle, mouth_open }`, each 0–1 |
| `blendshapes` | jsonb | all 52 raw values, kept so the formula can be re-tuned later |
| `overlay` | jsonb | normalized polylines and bbox (see §6.3) |
| `model_version` | text | e.g. `face_landmarker_f16_v1+formula_v1` |
| `created_at` | timestamptz, default `now()` | |

Index on `(user_id, created_at desc)` for the history list.

---

## 6. Scorer service spec (`apps/scorer`)

### 6.1 Endpoints

**`GET /health`** returns `{"status": "ok", "model_loaded": true}` and needs no auth. It's used by Render's health check and for warm-up.

**`POST /score`**
- Header: `X-Scorer-Key: <SCORER_API_KEY>`. Compare it with `hmac.compare_digest`. Return 401 if it's missing or wrong.
- Body: `multipart/form-data` with a field named `image`.
- Endpoint is defined with **`def`, not `async def`**, so FastAPI runs the CPU-bound inference in its threadpool instead of blocking the event loop.

**200 response:**
```json
{
  "face_count": 1,
  "smile_score": 78,
  "components": { "mouth_smile": 0.82, "eye_crinkle": 0.41, "mouth_open": 0.33 },
  "blendshapes": { "mouthSmileLeft": 0.84, "mouthSmileRight": 0.80, "...": 0.0 },
  "overlay": {
    "bbox": [0.31, 0.22, 0.38, 0.47],
    "lips": [[0.45, 0.61], [0.47, 0.62]],
    "left_eye": [[0.40, 0.40]],
    "right_eye": [[0.55, 0.40]],
    "face_oval": [[0.31, 0.30]]
  },
  "model_version": "face_landmarker_f16_v1+formula_v1"
}
```

All coordinates are normalized to 0–1 relative to the image width and height. `bbox` is `[x, y, w, h]`.

**Errors** (JSON body `{"error": "<code>", ...}`):

| Status | Code | When |
|---|---|---|
| 401 | `unauthorized` | Missing or wrong key |
| 413 | `too_large` | Body larger than `MAX_IMAGE_BYTES` |
| 415 | `unsupported_image` | Pillow can't open the file |
| 422 | `no_face` | Zero faces detected |
| 422 | `multiple_faces` (+ `face_count`) | Two or more faces detected |

### 6.2 Implementation notes

- **Tasks API only.** `mediapipe` ≥ 0.10.31 no longer ships `mediapipe.solutions`. Ignore any tutorial that uses `mp.solutions.face_mesh` or `drawing_utils`. Use `mediapipe.tasks.python.vision.FaceLandmarker`. (**VERIFY** option names against the current Python guide.)
- Options:
  - `running_mode = IMAGE`
  - `output_face_blendshapes = True` (it's **off by default**)
  - `num_faces = 2` (the default is 1, which would make multiple-face detection impossible)
- Load the model **once at startup** (FastAPI lifespan), never per request.
- Wrap `detect()` in a `threading.Lock`. MediaPipe task instances aren't documented as thread-safe, and FastAPI's threadpool runs requests concurrently. To scale, add instances, not threads.
- Image path: Pillow `Image.open` → `.convert("RGB")` → `np.asarray` → `mp.Image(image_format=mp.ImageFormat.SRGB, data=arr)`.
- The model file `face_landmarker.task` (float16) is downloaded in the Dockerfile and by `scripts/download_model.sh` for non-Docker runs. Don't commit it. (**VERIFY** the current model URL in the MediaPipe Face Landmarker docs.)

### 6.3 Overlay

Build polylines for lips, both eyes and the face oval from the connection constants in the Tasks API face landmarker module (**VERIFY** where they live). If they're not available, return all 478 points and let the frontend pick the index lists. The frontend draws an SVG with `viewBox="0 0 1 1"` and `preserveAspectRatio="none"` absolutely positioned over the `<img>`, so normalized coordinates map directly.

### 6.4 Scoring formula v1 (`scoring.py`, pure functions)

```
mouth = mean(mouthSmileLeft, mouthSmileRight)
eyes  = mean(cheekSquintLeft, cheekSquintRight)    # eye crinkle of a genuine smile
open  = jawOpen
gate  = clamp(mouth / MOUTH_GATE, 0, 1)            # a squint or a yawn alone can't score
raw   = W_MOUTH*mouth + gate*(W_EYES*eyes + W_OPEN*open)
score = round(100 * clamp((raw - FLOOR) / (CEIL - FLOOR), 0, 1))
```

Starting constants live in `config.py` and get calibrated in Phase 3:

| Constant | Start value |
|---|---|
| `W_MOUTH` | 0.75 |
| `W_EYES` | 0.15 |
| `W_OPEN` | 0.10 |
| `MOUTH_GATE` | 0.30 |
| `FLOOR` | 0.05 |
| `CEIL` | 0.85 |

`components` returns `mouth_smile = mouth`, `eye_crinkle = eyes`, `mouth_open = open`. Increment `formula_vN` in `model_version` whenever the constants change.

**`scripts/calibrate.py`:** runs the scorer over `tests/fixtures/calibration/*.jpg`. Each filename starts with a human label from 0 to 100, e.g. `050_slight.jpg`. It prints label vs. predicted per photo, the mean absolute error, and how many pairs are ranked in the wrong order. Use only no extra dependencies.

### 6.5 Dockerfile

- Base image `python:3.12-slim`.
- `apt-get install -y --no-install-recommends libgl1 libglib2.0-0`. OpenCV, which `mediapipe` pulls in, fails to import on slim images without these.
- `pip install -r requirements.txt`, then download the model to `/app/models/face_landmarker.task`.
- `CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`. Render sets `PORT`.

---

## 7. Web app spec (`apps/web`)

### 7.1 Auth

- Better Auth with `emailAndPassword: { enabled: true }` and the Drizzle adapter (`provider: "pg"`), mounted at `app/api/auth/[...all]/route.ts`. (**VERIFY** the handler helper and server session API in the current Better Auth Next.js docs.)
- Minimum password length: 8.
- **Session enforcement:** Next.js 16 renamed `middleware.ts` to `proxy.ts`. Use `proxy.ts` **only** for redirects that improve UX. Every server component, route handler and server action that touches user data calls `requireSession()` itself. CVE-2025-29927 showed that auth enforced only in middleware can be bypassed.

### 7.2 Client-side downscale (`lib/downscale.ts`)

1. Decode with `createImageBitmap(file, { imageOrientation: "from-image" })`.
2. Draw to a canvas with a maximum of 1600px on the longest side.
3. Call `canvas.toBlob("image/jpeg", 0.9)`.
4. If decoding fails (e.g. HEIC in Chrome), show "Please upload a JPEG, PNG or WebP".

### 7.3 Storage adapter (`lib/storage`)

```ts
interface Storage {
  put(pathname: string, data: Buffer, contentType: string): Promise<void>;
  get(pathname: string): Promise<ReadableStream | null>;
  del(pathname: string): Promise<void>;
}
```

- If `BLOB_READ_WRITE_TOKEN` is set, use the Vercel Blob adapter with **`access: "private"`** on both `put` and `get`.
- Otherwise, use the local adapter, which writes under `apps/web/.data/uploads/` (gitignored).
- **VERIFY** the current `@vercel/blob` private-store API. It launched in beta in February 2026.

### 7.4 Scorer client (`lib/scorer.ts`)

- Sends a `fetch` with `FormData`, the `X-Scorer-Key` header, and `AbortSignal.timeout(30_000)`.
- Validates the 200 response with a zod schema that mirrors §6.1. This makes the cross-service contract explicit.
- Maps scorer errors to typed results: `{ ok: false, code: "no_face" | "multiple_faces" | "unsupported_image" | "too_large" | "scorer_unavailable" }`.

### 7.5 Pages

| Page | Contents |
|---|---|
| `/login`, `/register` | react-hook-form + zod. On success, redirect to `/dashboard`. |
| `/dashboard` | Upload card (preview, submit, loading state, error messages) and a history grid of the user's uploads (thumbnail, score, date). The grid is a server component querying the DB directly. |
| `/results/[id]` | Server-side owner check, otherwise `notFound()`. Shows the photo with `FaceOverlay`, a big score number with a label, the breakdown bars, and the date. |
| `/profile` | Edit name and any extra fields from §1.1. A Server Action is fine here because the payload is small. |

Display labels for the score (UI only, not stored):

| Score | Label |
|---|---|
| 0–19 | Neutral |
| 20–44 | Slight smile |
| 45–74 | Smile |
| 75–100 | Big smile |

### 7.6 Friendly error copy

| Code | Message |
|---|---|
| `no_face` | "We couldn't find a face. Try a well-lit, front-facing photo." |
| `multiple_faces` | "We found more than one face. Please upload a photo of just one person." |
| `unsupported_image` | "That file isn't a supported image. Use JPEG, PNG or WebP." |
| `too_large` | "That image is too large." |
| `scorer_unavailable` | "Scoring is temporarily unavailable. Please try again in a minute." |

---

## 8. Environment variables

### `apps/web/.env.example`
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/smile   # prod: Neon pooled URL with sslmode=require
BETTER_AUTH_SECRET=                                              # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000                            # prod: Vercel URL
SCORER_URL=http://localhost:8000                                 # prod: Render URL
SCORER_API_KEY=dev-scorer-key                                    # must match the scorer
BLOB_READ_WRITE_TOKEN=                                           # prod only; leave empty for local disk
```

### `apps/scorer/.env.example`
```
SCORER_API_KEY=dev-scorer-key
MODEL_PATH=/app/models/face_landmarker.task
MAX_IMAGE_BYTES=5000000
```

Never commit real secrets. `.env*` files are gitignored except `.env.example`.

---

## 9. Local development

```bash
docker compose up -d            # postgres:16 on 5432, scorer on 8000
cd apps/web
pnpm install
cp .env.example .env.local      # then fill in BETTER_AUTH_SECRET
pnpm db:migrate
pnpm dev                        # http://localhost:3000
```

`package.json` scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `db:generate`, `db:migrate`.

---

## 10. Build phases

### Phase 0: Scaffold and deploy skeletons (Friday morning)

Tasks:
- Create the repo layout from §4.
- Scaffold `apps/web` with create-next-app: TypeScript, App Router, Tailwind, ESLint, `src/`, alias `@/*`. Then init shadcn/ui.
- Scaffold `apps/scorer` with `/health` only, plus its Dockerfile.
- Add `docker-compose.yml` and `.gitignore`.
- Add `apps/web/src/app/api/health/route.ts`, which runs `select 1` against the DB.
- Deploy the empty skeletons: create the Neon project, the Render Docker service (root dir `apps/scorer`, health check `/health`), and the Vercel project (root dir `apps/web`).

**Done when:** the Vercel URL loads, Render `/health` returns ok, and Vercel `/api/health` reaches Neon.

### Phase 1: Scorer (Friday)

Tasks:
- `landmarker.py`, `scoring.py`, `overlay.py`, and `/score` per §6.
- Model download script and Dockerfile step.
- pytest:
  - auth returns 401 without the key
  - no-face case (a generated solid-colour image) returns 422 `no_face`
  - `scoring.py` unit tests on hand-built blendshape dicts
  - **ordering test** on the owner's fixtures: `neutral < small_smile < big_smile`

**Done when:** pytest passes locally and in Docker, and `curl` with a smiling photo returns sensible JSON.

### Phase 2: Auth and profile (Friday afternoon)

Tasks:
- Better Auth + Drizzle, schema generation, migrations.
- Login, register and profile pages.
- `requireSession()` helper, plus `proxy.ts` redirects.

**Done when:**
- Register → log in → edit profile → log out works locally.
- Protected pages redirect when logged out.
- `POST /api/uploads` returns 401 without a session.

### Phase 3: Upload and results (Sunday)

Tasks:
- `uploads` table and migration, storage adapters, client downscale, `POST /api/uploads`, scorer client, image route.
- Results page with overlay and breakdown; dashboard history.
- Test each edge case by hand: no face, two faces, a `.txt` renamed to `.jpg`, a 20 MB photo, and a **portrait phone photo** (rotation).
- Calibrate the formula with 30–50 of the owner's photos using `calibrate.py`. Bump `formula_vN`.

**Done when:**
- The full flow works locally **and** in production.
- Every edge case shows its friendly message.
- User A gets a 404 for user B's upload ID, on both the results page and the image route.

### Phase 4: Hardening, tests, docs (Monday)

Tasks:
- Vitest tests for zod schemas, the scorer client error mapping, the local storage adapter, and the score-label function. Optionally, one Playwright happy path.
- `ci.yml`:
  - web job: lint, typecheck, test
  - scorer job: ruff, pytest, with the model file cached
- `README.md` (outline in §15) and `docs/DECISIONS.md` (from §11).
- Switch Render to the Starter instance for the review week. Run a production smoke test.

**Done when:** CI is green, a fresh clone runs by following only the README, and the production smoke test passes. Then **submit Monday night**.

### Tuesday: buffer only. No new features.

---

## 11. Decision record (copy to `docs/DECISIONS.md`)

| # | Decision | Chosen | Alternatives considered | Why |
|---|---|---|---|---|
| 1 | Web framework | Next.js App Router | React + Vite | Reviewers' stated preference. Server components remove the need for a client data-fetching library, and route handlers host the API in the same app. |
| 2 | Where scoring runs | Separate Python service | Inside Next.js; in the browser; Vercel Python function | MediaPipe's JS package targets browsers, not Node. Browser-side scoring would let a client forge its own score. On a Vercel Python function, MediaPipe's OpenCV dependency needs system libraries that can't be installed there. |
| 3 | Smile model | MediaPipe Face Landmarker blendshapes | AWS Rekognition, Google Vision, Azure Face, vision LLM | Rekognition only gives smiling yes/no plus a confidence, and confidence isn't smile size. Google gives a coarse five-step joy likelihood. Azure retired its smile attribute in 2023. LLMs aren't deterministic and cost per call. MediaPipe gives continuous 0–1 smile values, is free, always gives the same score for the same photo, and the image never leaves our own servers. |
| 4 | Scorer framework | FastAPI, sync `def` endpoint, lock around inference | Flask | The typed Pydantic response model is the cross-service contract, and `/docs` lets reviewers test scoring on its own. A sync `def` runs CPU-bound inference in the threadpool rather than blocking the event loop. The lock is there because MediaPipe task instances aren't documented as thread-safe. |
| 5 | Auth library | Better Auth, email/password, sessions stored in the DB | Auth.js v5, Clerk | Auth.js treats email/password as second-class and pushes toward JWT sessions. Clerk is hosted, so user data lives off-site. Better Auth keeps users and sessions in our own Postgres. |
| 6 | Auth enforcement | Session check in every handler, component and action; `proxy.ts` for redirects only | Middleware-only checks | CVE-2025-29927 showed that middleware-only auth in Next.js can be bypassed. |
| 7 | ORM | Drizzle + drizzle-kit | Prisma | SQL-shaped and lightweight, with a first-class Better Auth adapter. |
| 8 | DB driver | node-postgres with Neon's pooled URL | Neon's serverless driver | One driver works both against local Docker Postgres and in production. |
| 9 | Database host | Neon (free) | Render Postgres | Neon's free plan is permanent. Render's free database expires after 30 days. |
| 10 | Image storage | Private Vercel Blob, with a local-disk adapter in dev | Public Blob, local disk on Vercel, S3 | Face photos shouldn't sit behind guessable public URLs, and Vercel's disk doesn't persist. Every read goes through an owner-checked route. S3 is the production swap. |
| 11 | Upload path | Client downscale → route handler → sharp → scorer → storage | Direct-to-Blob client upload | The server normalizes and scores the image in one validated step. Downscaling in the browser handles Vercel's 4.5 MB body limit. A route handler is used instead of a Server Action because of the 1 MB default limit on Server Actions. |
| 12 | Image normalization | sharp: rotate, resize, re-encode | Store the original | Fixes phone EXIF rotation, which otherwise makes faces arrive sideways and go undetected. Re-encoding also strips GPS and other metadata. |
| 13 | Service-to-service auth | Shared-secret header, constant-time compare | mTLS, signed JWT | Proportionate for two services owned by one app. |
| 14 | Hosting | Vercel (web), Render Starter (scorer) | Render free tier, a VPS | Render's free tier sleeps after 15 minutes idle and takes about a minute to wake. $7 avoids reviewers hitting a cold start. |
| 15 | Store raw blendshapes + `model_version` | Yes | Store the score only | Lets the formula be re-tuned and audited without reprocessing images. |

---

## 12. Security checklist

- [ ] Passwords hashed by Better Auth. Minimum length 8.
- [ ] Session checked in every server component, route handler and server action that touches user data.
- [ ] Every upload query filters on `user_id`. Foreign IDs return 404.
- [ ] Blob store is private. Images are only served through the owner-checked route.
- [ ] Uploads re-encoded by sharp, which strips metadata.
- [ ] Type allowlist and size limits enforced on both web and scorer.
- [ ] Scorer key compared with `hmac.compare_digest`. Scorer rejects requests without the key.
- [ ] No secrets in git. `.env.example` files only.
- [ ] Test fixtures contain only the owner's own photos.

---

## 13. Deployment

1. **Neon:** create the project and copy the **pooled** connection string with `sslmode=require`. Run `pnpm db:migrate` against it.
2. **Render:**
   - New Web Service from the repo, root directory `apps/scorer`, runtime Docker.
   - Set `SCORER_API_KEY`.
   - Health check path `/health`.
   - Instance type **Starter** during the review week.
3. **Vercel:**
   - Import the repo, root directory `apps/web`.
   - Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SCORER_URL`, `SCORER_API_KEY`.
   - Create a **private** Blob store and connect it to the project (this adds `BLOB_READ_WRITE_TOKEN`).
4. **Smoke test in production:**
   - register
   - upload a smiling photo
   - upload a no-face photo
   - open someone else's result ID and confirm a 404
   - log out

---

## 14. Known gotchas (check these first when something breaks)

- `mediapipe.solutions` doesn't exist in recent versions. Use the Tasks API.
- Blendshapes are off by default (`output_face_blendshapes=True`). `num_faces` defaults to 1.
- `ImportError: libGL.so.1` in Docker means `libgl1` and `libglib2.0-0` are missing.
- A 413 from Vercel means a request over 4.5 MB reached a function, so check the client downscale.
- A Server Action used for uploads would hit the 1 MB default body limit. Uploads go through the route handler.
- Next.js 16 uses `proxy.ts`. Older auth docs still show `middleware.ts`.
- Render's free tier cold-starts in about a minute. The web app should show `scorer_unavailable` instead of hanging.
- **VERIFY** that a `mediapipe` wheel exists for Python 3.12 on linux/amd64 before building on it.

---

## 15. README outline

1. What it does: one paragraph and a screenshot.
2. Live demo URL and a test account (optional).
3. Architecture: the §2 mermaid diagram and upload flow.
4. How the smile score works: the formula, what each component means, and calibration notes.
5. Running locally: §9.
6. Tests: how to run them.
7. Key decisions: short summary linking to `docs/DECISIONS.md`.
8. Known limitations: §1.3, plus "the score is a calibrated heuristic, not a validated psychological measure".
9. What I'd do next for production: S3, a job queue for scoring, rate limiting, a liveness check, and HEIC support.
