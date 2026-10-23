---
type: prompt
plan: "[[2026-10-23-smile-score-mvp]]"
id: 06
unit:
status: todo
model: haiku
effort: low
depends_on: [05]
parallel_group:
files:
  create: [apps/scorer/scripts/calibrate.py]
  modify: []
  delete: []
---
# 06 · `scripts/calibrate.py`

## Task
Write a CLI script that scores every labelled calibration photo and reports how well the formula matches the
human labels.

## Context
- Repo: `/home/apa/Code/smile-score-app/apps/scorer`. Spec: PLAN.md §6.4. Use only the stdlib and the project's
  existing deps (Pillow, numpy, the app modules). No new dependencies.
- Reuse the app code, and don't duplicate the scoring logic:
  `from app import config`, `from app.landmarker import Landmarker`, `from app.scoring import smile_score`.
  Load each image the way `/score` does: `Image.open` → `ImageOps.exif_transpose` → `.convert("RGB")` →
  `np.asarray`.
- Input: `tests/fixtures/calibration/*.jpg`. Each filename starts with a 3-digit human label from 0 to 100, for
  example `050_slight.jpg`. Take an optional `argparse` positional `dir` (that default) and `--model` (default
  `config.MODEL_PATH`).
- Output: a table with columns `file`, `label`, `predicted`, `diff` (skip files with no face or 2+ faces, and
  print the reason), then `MAE: x.xx`, then `Mis-ordered pairs: k / total`. A pair (i, j) is mis-ordered when
  `label_i < label_j` and `pred_i > pred_j`. Finally, print `config.MODEL_VERSION`.
- Run it as `python scripts/calibrate.py` from `apps/scorer`. Put `sys.path.insert(0, str(Path(__file__).resolve().parents[1]))`
  at the top, so `app` resolves without packaging.

## Do not
- Touch files outside the `files` list.
- Add dependencies.
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app/apps/scorer
.venv/bin/ruff check scripts && .venv/bin/ruff format --check scripts
.venv/bin/python scripts/calibrate.py "$(mktemp -d)"   # prints "no images" cleanly, exit 0
```
- With 2 or more labelled photos, it prints the table, the MAE and the mis-ordered count.
