---
type: prompt
plan: "[[2026-10-23-smile-score-mvp]]"
id: 03
unit:
status: todo
model: sonnet
effort: medium
depends_on: [01]
parallel_group:
files:
  create: [apps/scorer/app/scoring.py, apps/scorer/tests/test_scoring.py]
  modify: [apps/scorer/app/config.py]
  delete: []
---
# 03 · Scoring formula v1 (pure functions) + tests

## Task
Implement the smile-score formula as pure functions over a blendshape dict, put its constants in `config.py`,
and unit-test it with hand-built dicts. No mediapipe import here.

## Context
- Repo: `/home/apa/Code/smile-score-app/apps/scorer`, venv `.venv` (from prompt 01). Spec: PLAN.md §6.4.
- Add to `app/config.py` (module-level, uppercase, a comment noting that the Phase 3 calibration tunes them, and
  that any change must bump the formula version):
  ```python
  W_MOUTH = 0.75
  W_EYES = 0.15
  W_OPEN = 0.10
  MOUTH_GATE = 0.30
  FLOOR = 0.05
  CEIL = 0.85
  FORMULA_VERSION = "formula_v1"
  MODEL_VERSION = f"face_landmarker_f16_v1+{FORMULA_VERSION}"
  ```
- `app/scoring.py` exposes exactly:
  ```python
  def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float
  def components(blendshapes: Mapping[str, float]) -> dict[str, float]
      # {"mouth_smile": mean(mouthSmileLeft, mouthSmileRight),
      #  "eye_crinkle": mean(cheekSquintLeft, cheekSquintRight),
      #  "mouth_open": jawOpen}   missing keys count as 0.0
  def smile_score(blendshapes: Mapping[str, float]) -> tuple[int, dict[str, float]]
  ```
  The formula (verbatim from PLAN):
  ```
  gate  = clamp(mouth / MOUTH_GATE, 0, 1)
  raw   = W_MOUTH*mouth + gate*(W_EYES*eyes + W_OPEN*open)
  score = round(100 * clamp((raw - FLOOR) / (CEIL - FLOOR), 0, 1))
  ```
  Reference the constants as `config.W_MOUTH` (module import), so tests can monkeypatch them. Return an
  `int` score. Round the component values to 4 decimals.
- `tests/test_scoring.py`. Cover these cases:
  - all zeros scores 0
  - all relevant values at 1.0 score 100
  - eyes and jaw high with mouth 0: the gate holds the score at 0 ("a squint or a yawn alone can't score")
  - monotonic: a bigger `mouthSmile*` never lowers the score
  - the score is always an int in 0..100 over a small grid of inputs
  - the component keys and values for a known input
  - missing keys default to 0
  - `MODEL_VERSION` ends with `FORMULA_VERSION`

## Do not
- Touch files outside the `files` list. If you must, stop and report why.
- Import numpy or mediapipe in `scoring.py`. Keep it pure Python.
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app/apps/scorer
.venv/bin/ruff check . && .venv/bin/ruff format --check . && .venv/bin/pytest -q tests/test_scoring.py tests/test_health.py
```
