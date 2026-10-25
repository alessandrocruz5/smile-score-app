---
type: prompt
plan: "[[2026-10-23-smile-score-mvp]]"
id: 20
unit:
status: done
model: sonnet
effort: medium
depends_on: [19]
parallel_group:
files:
  create: [docs/DECISIONS.md]
  modify: [README.md]
  delete: []
---
# 20 · README + DECISIONS.md

## Task
Write the reviewer-facing `README.md` and `docs/DECISIONS.md`. Reviewers read these first, and the owner defends
them in a live Q&A, so keep them accurate, short and plain. **Every claim must match the code as built.** Check the
code before you state anything.

## Context
- Repo: `/home/apa/Code/smile-score-app`. Spec: PLAN.md §2 (the mermaid diagram and the upload flow), §6.4 (the
  formula), §9 (local dev), §11 (the decision table), §13 (deployment), §15 (the README outline), §1.3 (non-goals).
  The plan is `docs/plans/2026-10-23-smile-score-mvp/2026-10-23-smile-score-mvp.md` (its Decisions section).
- **`README.md`** follows the §15 outline exactly:
  1. What it does: one paragraph, plus a screenshot placeholder `docs/screenshot.png` (the owner adds it).
  2. Live demo: placeholders `<VERCEL_URL>`, plus "test account on request".
  3. Architecture: the §2 mermaid diagram, verbatim, and the 7-step upload flow.
  4. How the smile score works: the formula, what each component means (mouth smile, eye crinkle (the "Duchenne"
     cheek squint), mouth open), the gate rationale, the current constants **read from `apps/scorer/app/config.py`**,
     the current `MODEL_VERSION`, and how `scripts/calibrate.py` works. Leave a "Calibration notes" placeholder for
     the owner's MAE and mis-ordered numbers.
  5. Running locally: PLAN §9, plus the scorer venv (`uv venv --python 3.12` or plain `python3.12 -m venv`), and
     `scripts/download_model.sh models` for non-Docker runs.
  6. Tests: the web commands (`pnpm lint`, `typecheck`, `test`) and the scorer commands (`ruff`, `pytest`), noting that
     the model-dependent tests skip without the model, and the ordering test skips without the owner fixtures.
  7. Key decisions: 5–6 bullets linking to `docs/DECISIONS.md`.
  8. Known limitations: PLAN §1.3; "the score is a calibrated heuristic, not a validated psychological measure";
     no account deletion (uploads can be deleted one by one; deleting a user row directly would orphan their
     blobs); no rate limiting beyond Better Auth's defaults.
  9. **Privacy:** what is stored (the normalized JPEG with metadata stripped, the scores, the blendshapes and the
     landmark segments) and why the raw blendshapes are kept (re-tuning, DECISIONS #15). Images are private and only
     served through the owner-checked route. Nothing is stored when scoring fails. Users can delete any upload
     from its results page, which removes the image and the row (blob first, then row). Then, reading each from the
     code:
     - **Consent:** every upload needs the ticked checkbox, and the server rejects uploads without it
       (`consent_required`), so each row records consent at its `created_at`.
     - **Retention:** a daily Vercel Cron job (`/api/cron/purge`, protected by `CRON_SECRET`) deletes photos and
       their data after `PHOTO_RETENTION_DAYS` days.
     - **Scorer:** it processes images in memory and never logs or stores them. Say honestly that Starlette may
       spool a part over 1 MB to a temp file it deletes at the end of the request.
     - **Demo data:** all accounts and photos are deleted when the review period ends.
     - **Face geometry:** the landmark segments are biometric-adjacent data ("face geometry" under BIPA; special
       category data under GDPR Art. 9).
  10. What I'd do next for production. Give each item one line of reasoning, framed as deliberate MVP scope
      cuts, not regrets:
      - S3, a scoring job queue, rate limiting, a liveness check, HEIC support
      - **data minimization:** store only the bbox, not the landmark segments, or offer a "score only, don't keep my
        photo" mode
      - account deletion and data export (GDPR Arts. 17 and 20)
      - BIPA-grade written consent and a published retention schedule
      - per-user encryption keys, an access audit log, and pinning data to one region
- **`docs/DECISIONS.md`:** the PLAN §11 table verbatim (rows 1–15), then these rows added from the plan's
  Decisions:
  - 16 Overlay format: segments `[x1,y1,x2,y2]` / polylines / all 478 points. MediaPipe's connection constants are
    edge lists; segments map 1:1 with no chaining logic, and the SVG uses `non-scaling-stroke`.
  - 17 Owner-scoped query module (`lib/uploads.ts`) / ad-hoc queries. One place enforces the `user_id` filter;
    non-UUID IDs return 404, not a 500.
  - 18 Client raw-size cap of 25 MB, then downscale / server-only limit. Avoids decoding huge files in the browser;
    phone photos still succeed.
  - 19 Tests written with each feature / batched in Phase 4. Every step stays verifiable.
  - 20 Scorer fails closed when the key is unset / open in dev. A misconfigured deploy can't expose `/score`.
  - 21 Delete an upload: blob first, then row, via `DELETE /api/uploads/[id]` / row first / no delete. A failure
    never leaves an unreachable face photo; both steps are idempotent, so a retry completes it.
  - 22 Type allowlist on the real format (sharp `metadata().format`, Pillow `img.format`) / trust the declared
    `Content-Type`. A GIF or SVG relabelled `image/jpeg` is rejected on both services.
  - 23 mediapipe version: the version pinned in `apps/scorer/requirements.txt` (read it; 1.x or 0.10.35, per
    prompts 01 and 04) / the other line. Write the reason the build actually used.
  - 24 Consent enforced on the server (`consent=true` required by `POST /api/uploads`) / a client-only checkbox / a
    passive notice. A checkbox alone can be bypassed with curl; the server check makes each row's `created_at` the
    consent record.
  - 25 Photo retention: a 30-day daily purge via Vercel Cron (blob first, then row; fails closed without
    `CRON_SECRET`) / keep forever / manual deletion only. It limits how long face data is held, and the consent text
    states the same constant.
  Add a one-line header: "Kept up to date as decisions change."

## Do not
- Touch files outside the `files` list.
- Invent numbers (calibration MAE, latency) or URLs. Use placeholders the owner fills in.
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app
grep -c '^| [0-9]' docs/DECISIONS.md                      # 25
grep -n 'W_MOUTH' README.md && grep -n 'W_MOUTH' apps/scorer/app/config.py   # values match
grep -nE '^## ' README.md                                 # the sections in §15 order, plus Privacy
```
- Fresh-clone check (owner, M4): following only the README, a clean clone runs locally.
