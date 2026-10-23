---
type: prompt
plan: "[[2026-10-23-smile-score-mvp]]"
id: 18
unit:
status: todo
model: sonnet
effort: medium
depends_on: [17]
parallel_group:
files:
  create: [docs/DECISIONS.md]
  modify: [README.md]
  delete: []
---
# 18 · README + DECISIONS.md

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
     no upload or account deletion, so deleting a user would orphan their blobs; no rate limiting beyond Better
     Auth's defaults.
  9. **Privacy:** what is stored (the normalized JPEG with metadata stripped, the scores, the blendshapes and the
     landmark segments) and why the raw blendshapes are kept (re-tuning, DECISIONS #15). Images are private and only
     served through the owner-checked route. Nothing is stored when scoring fails. Face geometry is
     biometric-adjacent data, and production would add explicit consent, retention limits and deletion.
  10. What I'd do next for production: S3, a scoring job queue, rate limiting, a liveness check, HEIC support,
      delete or export of data.
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
  Add a one-line header: "Kept up to date as decisions change."

## Do not
- Touch files outside the `files` list.
- Invent numbers (calibration MAE, latency) or URLs. Use placeholders the owner fills in.
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app
grep -c '^| [0-9]' docs/DECISIONS.md                      # 20
grep -n 'W_MOUTH' README.md && grep -n 'W_MOUTH' apps/scorer/app/config.py   # values match
grep -nE '^## ' README.md                                 # the sections in §15 order, plus Privacy
```
- Fresh-clone check (owner, M4): following only the README, a clean clone runs locally.
