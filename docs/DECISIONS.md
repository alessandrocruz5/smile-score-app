# Decision record

Kept up to date as decisions change.

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
| 16 | Overlay format | Segments `[x1,y1,x2,y2]` per feature | Ordered polylines; all 478 raw points | MediaPipe's connection constants are edge lists, so segments map 1:1 with no chaining logic. The SVG uses `non-scaling-stroke`. |
| 17 | Owner-scoped query module | `lib/uploads.ts` | Ad-hoc queries in each handler | One place enforces the `user_id` filter. Non-UUID IDs return 404, not a 500. |
| 18 | Client raw-size cap | 25 MB on the client, then downscale | Server-only size limit | Avoids decoding huge files in the browser, and phone photos still succeed. The server still enforces 4 MB after downscale. |
| 19 | When tests are written | With each feature | Batched in Phase 4 | Every step stays verifiable. |
| 20 | Scorer with no key configured | Fails closed when `SCORER_API_KEY` is unset | Open in dev | A misconfigured deploy can't expose `/score`. |
| 21 | Deleting an upload | `DELETE /api/uploads/[id]`: blob first, then row | Row first; no delete | A failure never leaves an unreachable face photo. Both steps are idempotent, so a retry completes it. |
| 22 | Image type allowlist | Check the real format (sharp `metadata().format`, Pillow `img.format`) | Trust the declared `Content-Type` | A GIF or SVG relabelled `image/jpeg` is rejected on both services. |
| 23 | mediapipe version | `mediapipe==1.1.1` (pinned in `apps/scorer/requirements.txt`) | `mediapipe==0.10.35`, the last 0.10 | 1.1.1 is PyPI's latest. Prompt 04 checked the Face Landmarker options and connection constants against it and they matched, so the 0.10.35 fallback was not needed. |
| 24 | Consent | Enforced on the server (`consent=true` required by `POST /api/uploads`, else `consent_required`) | Client-only checkbox; passive notice | A checkbox alone can be bypassed with curl. The server check makes each row's `created_at` the consent record. |
| 25 | Photo retention | 30-day daily purge via Vercel Cron (blob first, then row; fails closed without `CRON_SECRET`) | Keep forever; manual deletion only | It limits how long face data is held, and the consent text states the same constant (`PHOTO_RETENTION_DAYS`). |
