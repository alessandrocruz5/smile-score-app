---
type: prompt
plan: "[[2026-10-23-smile-score-mvp]]"
id: 04
unit:
status: todo
model: sonnet
effort: high
depends_on: [03]
parallel_group:
files:
  create: [apps/scorer/app/landmarker.py, apps/scorer/app/overlay.py, apps/scorer/tests/test_overlay.py]
  modify: [apps/scorer/app/main.py]
  delete: []
---
# 04 · Landmarker (load once, lock) + overlay segments

## Task
Wrap MediaPipe's Face Landmarker (the Tasks API) so the model loads once at startup and calls to `detect()` are
serialized. Then turn the landmarks into normalized overlay segments and a bbox. Wire the startup into the
FastAPI lifespan and make `/health` report the real `model_loaded`.

## Context
- Repo: `/home/apa/Code/smile-score-app/apps/scorer`, venv `.venv`, model at `models/face_landmarker.task`
  (from prompt 01). Spec: PLAN.md §6.2, §6.3.
- **VERIFY** against the current MediaPipe Python Face Landmarker guide (Tasks API). Check the option names and the
  location of the connection constants in the installed package (`python -c "from
  mediapipe.tasks.python.vision import face_landmarker as f; print(dir(f))"`). The expected shape:
  ```python
  from mediapipe.tasks import python as mp_python
  from mediapipe.tasks.python import vision
  opts = vision.FaceLandmarkerOptions(
      base_options=mp_python.BaseOptions(model_asset_path=path),
      running_mode=vision.RunningMode.IMAGE,
      output_face_blendshapes=True,   # off by default
      num_faces=2,                    # default 1 would hide multiple faces
  )
  landmarker = vision.FaceLandmarker.create_from_options(opts)
  ```
  The connections are expected at `vision.FaceLandmarksConnections.FACE_LANDMARKS_LIPS`, `..._LEFT_EYE`,
  `..._RIGHT_EYE` and `..._FACE_OVAL`, each a list of `Connection(start, end)`. If they aren't in the installed
  version, stop and report. Don't hand-copy index lists without telling me.
- `app/landmarker.py`:
  ```python
  class Landmarker:
      def __init__(self, model_path: str) -> None      # creates the task once
      def detect(self, rgb: np.ndarray) -> vision.FaceLandmarkerResult
          # with self._lock (threading.Lock): mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb) -> detect
      def close(self) -> None
  ```
  Comment why the lock exists: task instances aren't documented as thread-safe, and FastAPI's threadpool runs
  sync endpoints concurrently. To scale, add instances, not threads. The image is `np.ascontiguousarray(rgb,
  dtype=np.uint8)`.
- `app/overlay.py` (a pure function, no mediapipe import except for the connection constants):
  ```python
  Segment = tuple[float, float, float, float]   # x1, y1, x2, y2, normalized 0..1
  def build_overlay(landmarks: Sequence[Any]) -> dict
      # landmarks: one face's list of objects with .x/.y (normalized)
      # returns {"bbox": [x, y, w, h], "lips": [Segment...], "left_eye": [...],
      #          "right_eye": [...], "face_oval": [...]}
  ```
  Clamp every coordinate to 0..1 and round to 4 decimals. Compute the bbox from the min and max over all landmarks.
  `left_eye` follows MediaPipe's naming (the subject's left), so say so in a comment. **The overlay is segments,
  not polylines.** This is a plan decision: the connection constants are edge lists, and the frontend draws
  `M x1 y1 L x2 y2` per segment.
- `app/main.py`: add an `asynccontextmanager` lifespan that builds `Landmarker(config.MODEL_PATH)` into
  `app.state.landmarker` and closes it on shutdown. Startup must fail loudly if the model file is missing.
  `/health` returns `{"status": "ok", "model_loaded": getattr(app.state, "landmarker", None) is not None}`.
- `tests/test_overlay.py`: feed `build_overlay` a fake list of 478 `SimpleNamespace(x=..., y=...)` points (including
  out-of-range values) and assert the keys, the segment arity (4), the clamping, the bbox math, and that the segment
  counts equal the lengths of the connection constants.
- `tests/conftest.py` exists (it sets `SCORER_API_KEY`). `tests/test_health.py` now triggers the lifespan when you
  use `with TestClient(app) as c:`. Update it **only if needed**: skip it with `pytest.mark.skipif` when
  `config.MODEL_PATH` doesn't exist, and assert `model_loaded is True` otherwise. That file is outside `files`,
  so if you change it, say so.

## Do not
- Touch files outside the `files` list, except `tests/test_health.py` as described above.
- Use `mediapipe.solutions` or `drawing_utils`.
- Load the model per request.
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app/apps/scorer
.venv/bin/ruff check . && .venv/bin/ruff format --check . && .venv/bin/pytest -q
cd ../.. && docker compose up -d --build scorer && sleep 8 && curl -s localhost:8000/health   # model_loaded true
```
