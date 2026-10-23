---
type: prompt
plan: "[[2026-10-23-smile-score-mvp]]"
id: 05
unit:
status: todo
model: sonnet
effort: high
depends_on: [04]
parallel_group:
files:
  create: [apps/scorer/app/schemas.py, apps/scorer/tests/test_api.py]
  modify: [apps/scorer/app/main.py]
  delete: []
---
# 05 · `POST /score`: key check, limits, error mapping, response schema + API tests

## Task
Add the `/score` endpoint: it authenticates with a shared key, reads and validates the image, runs the landmarker,
enforces exactly one face, scores it, and returns the typed response. Test it end to end with the real model.

## Context
- Repo: `/home/apa/Code/smile-score-app/apps/scorer`. Already present: `app/config.py` (`SCORER_API_KEY`,
  `MAX_IMAGE_BYTES`, `MODEL_VERSION`), `app/scoring.py` (`smile_score(bs) -> (int, components)`),
  `app/landmarker.py` (`app.state.landmarker.detect(rgb)`), `app/overlay.py` (`build_overlay(landmarks)`), and
  `main.py` with the lifespan and `/health`. Spec: PLAN.md §6.1.
- `app/schemas.py`, Pydantic v2. **This exact contract is mirrored in the web zod schema (prompt 11).**
  ```python
  class Components(BaseModel): mouth_smile: float; eye_crinkle: float; mouth_open: float
  class Overlay(BaseModel):
      bbox: tuple[float, float, float, float]
      lips: list[tuple[float, float, float, float]]
      left_eye: list[...]; right_eye: list[...]; face_oval: list[...]   # same segment type
  class ScoreResponse(BaseModel):
      face_count: int; smile_score: int = Field(ge=0, le=100); components: Components
      blendshapes: dict[str, float]; overlay: Overlay; model_version: str
  ```
- Errors always have the JSON body `{"error": "<code>", ...}`. Define `class ScorerError(Exception)` with
  `(status, code, **extra)`, plus one `@app.exception_handler(ScorerError)` that returns `JSONResponse`.
  | Status | Code | When |
  |---|---|---|
  | 401 | `unauthorized` | the `X-Scorer-Key` header is missing or wrong, **or** `config.SCORER_API_KEY` is empty (fail closed) |
  | 413 | `too_large` | the image bytes exceed `MAX_IMAGE_BYTES` |
  | 415 | `unsupported_image` | Pillow can't open or decode it |
  | 422 | `no_face` | zero faces |
  | 422 | `multiple_faces`, plus `"face_count": n` | two or more faces |
- The key check is a dependency, `def require_key(x_scorer_key: str | None = Header(default=None))`, using
  `hmac.compare_digest(given.encode(), expected.encode())`. Attach it with `dependencies=[Depends(require_key)]`, so
  it runs before body validation. Read `config.SCORER_API_KEY` at call time (not import time), so tests can
  monkeypatch it.
- **Privacy (R14, a plan decision): the image lives in memory only.** Never write it to disk yourself, never log
  its bytes (raw or base64) or Pillow's error text about it, and never echo any input in an error body. Error
  bodies contain only `error` (plus `face_count`). Write a comment in `main.py` saying so, and noting (VERIFY in
  the installed Starlette) that Starlette's multipart parser may spool a part over 1 MB to a temporary file that
  it deletes when the request ends. Don't work around that; the README states it.
- The endpoint is a **sync `def`** (comment: CPU-bound inference runs in the threadpool instead of blocking the event
  loop): `@app.post("/score", response_model=ScoreResponse) def score(request: Request, image: UploadFile = File(...))`.
  1. `data = image.file.read(config.MAX_IMAGE_BYTES + 1)`. If it's longer than the max, return 413.
  2. Open it with Pillow: `img = Image.open(BytesIO(data))`. **Format allowlist (security checklist, PLAN §12):**
     if `img.format not in {"JPEG", "PNG", "WEBP"}`, return 415. Read the format before any transform, because
     `exif_transpose`/`convert` return images with no `format`. Then `img.load()`, `ImageOps.exif_transpose(img)`
     and `.convert("RGB")`. Catch `(UnidentifiedImageError, OSError, Image.DecompressionBombError)` and return 415.
  3. `rgb = np.asarray(img)`, then `result = request.app.state.landmarker.detect(rgb)`.
  4. `n = len(result.face_landmarks)`. 0 is `no_face`, and 2 or more is `multiple_faces` (`face_count=n`).
  5. Build `bs = {c.category_name: round(c.score, 4) for c in result.face_blendshapes[0]}`, call
     `smile_score(bs)` and `build_overlay(result.face_landmarks[0])`, and return `ScoreResponse(face_count=1, ...,
     model_version=config.MODEL_VERSION)`.
- `tests/test_api.py`. Skip the module with `pytest.mark.skipif` when the model file is missing, and use
  `with TestClient(app) as client`. Authorized requests send `{"X-Scorer-Key": config.SCORER_API_KEY}` (never a
  literal key), so the same tests pass locally, in CI and inside the Docker image:
  - no header, and a wrong header, each return 401 `{"error":"unauthorized"}`
  - an empty `config.SCORER_API_KEY` (monkeypatch) returns 401 even with a header
  - `b"not an image"` returns 415 `unsupported_image`
  - a valid 50×50 **GIF** generated with Pillow returns 415 `unsupported_image` (the format allowlist)
  - privacy: for every error case above, the JSON keys are a subset of `{"error", "face_count"}`; and with
    `caplog.set_level(logging.DEBUG)`, posting `b"not an image PRIVACY-MARKER-7f3a"` leaves no
    `PRIVACY-MARKER-7f3a` in `caplog.text`
  - a byte payload over `MAX_IMAGE_BYTES` (monkeypatch the limit small) returns 413 `too_large`
  - a solid-colour 400×400 PNG generated with Pillow returns 422 `no_face`
  - **ordering test:** if `tests/fixtures/{neutral,small_smile,big_smile}.jpg` all exist (the owner's own photos),
    then `neutral < small_smile < big_smile`, and the 200 body validates against `ScoreResponse` and has 52
    blendshapes. Otherwise skip, with the reason "owner fixtures missing".

## Do not
- Touch files outside the `files` list. If you must, stop and report why.
- Use `async def` for `/score`.
- Compare the key with `==`.
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app/apps/scorer
.venv/bin/ruff check . && .venv/bin/ruff format --check . && .venv/bin/pytest -q -rs
cd ../.. && docker compose up -d --build scorer && sleep 8
curl -s -o /dev/null -w '%{http_code}\n' -F image=@README.md localhost:8000/score                       # 401
curl -s -H 'X-Scorer-Key: dev-scorer-key' -F image=@README.md localhost:8000/score                       # 415 body
# pytest inside the image: the no-face test runs a real detect() on the slim image (PLAN Phase 1: "in Docker")
docker compose run --rm -v "$PWD/apps/scorer/tests:/app/tests:ro" -v "$PWD/apps/scorer/pyproject.toml:/app/pyproject.toml:ro" scorer \
  sh -c 'pip install -q pytest httpx && python -m pytest -q -rs'
docker stats --no-stream --format '{{.Name}} {{.MemUsage}}'   # report the scorer's memory (Render instances have 512 MB)
```
- With a smiling photo (the owner provides it): the curl returns JSON with `smile_score`, 4 overlay arrays of
  4-tuples, and `model_version` = `face_landmarker_f16_v1+formula_v1`. `/docs` renders.
