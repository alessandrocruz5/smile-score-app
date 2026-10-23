---
type: prompt
plan: "[[2026-10-23-smile-score-mvp]]"
id: 01
unit:
status: todo
model: sonnet
effort: medium
depends_on: []
parallel_group:
files:
  create: [.gitignore, docker-compose.yml, apps/scorer/app/__init__.py, apps/scorer/app/main.py, apps/scorer/app/config.py, apps/scorer/requirements.txt, apps/scorer/requirements-dev.txt, apps/scorer/pyproject.toml, apps/scorer/Dockerfile, apps/scorer/.env.example, apps/scorer/scripts/download_model.sh, apps/scorer/tests/__init__.py, apps/scorer/tests/conftest.py, apps/scorer/tests/test_health.py]
  modify: []
  delete: []
---
# 01 · Scorer skeleton, Docker, model download, root files

## Task
Scaffold the Python scorer service with only `GET /health`, a Dockerfile that installs mediapipe and downloads
the Face Landmarker model, plus the repo-root `.gitignore` and `docker-compose.yml`. This is Phase 0. Its job
is to surface the Docker and mediapipe risk on the first Render deploy.

## Context
- Repo root: `/home/apa/Code/smile-score-app`. The spec is `PLAN.md` at the root (§6 scorer, §6.5 Dockerfile,
  §8 env, §14 gotchas). The decided stack is Python 3.12, FastAPI + uvicorn, mediapipe (Tasks API only), Pillow,
  numpy, python-multipart. Don't add other runtime libraries.
- Python 3.12 isn't installed system-wide. Use `uv venv --python 3.12 apps/scorer/.venv`, then
  `uv pip install --python apps/scorer/.venv -r ...`.
- **VERIFY before pinning:** mediapipe now ships **`py3-none-manylinux_2_28_x86_64`** wheels, not `cp312` ones.
  At audit time (2026-10-23) the latest was `1.1.1`, a new major (1.0.0 shipped 2026-07-27), while PLAN.md was
  written for 0.10.x. Check PyPI for that wheel tag. Install the unpinned direct deps into the fresh venv, then pin
  the **exact installed versions of the direct deps only**
  in `requirements.txt`: `fastapi`, `uvicorn`, `mediapipe`, `pillow`, `numpy`, `python-multipart`. Use any numpy
  version mediapipe accepts. **Report the mediapipe version you pinned**: prompt 04 checks its API against
  that version and may re-pin `mediapipe==0.10.35`. `requirements-dev.txt` starts with `-r requirements.txt` and adds pinned `pytest`,
  `ruff` and `httpx` (FastAPI's TestClient needs it).
- **VERIFY the model URL** in the MediaPipe Face Landmarker docs (float16). The expected URL is
  `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`.
- `app/config.py`: read the env with `os.environ` (no new libs):
  - `SCORER_API_KEY = os.environ.get("SCORER_API_KEY", "")`
  - `MODEL_PATH = os.environ.get("MODEL_PATH", "models/face_landmarker.task")`. The relative default resolves to
    `/app/models/...` in Docker (WORKDIR `/app`) and to `apps/scorer/models/...` locally.
  - `MAX_IMAGE_BYTES = int(os.environ.get("MAX_IMAGE_BYTES", "5000000"))`
  - Add a module docstring line saying the scoring constants arrive in prompt 03. No placeholders.
- `app/main.py`: `app = FastAPI(title="Smile Scorer")`, and `GET /health` returns
  `{"status": "ok", "model_loaded": False}`. Prompt 04 changes it to report the real state. Use a sync `def`.
- `scripts/download_model.sh`: `set -euo pipefail`, a `MODEL_URL` variable, and a target dir argument (default
  `models`). `mkdir -p`, then `curl -fsSL -o "$dir/face_landmarker.task" "$MODEL_URL"`. Skip it if the file exists.
  Make it `chmod +x`.
- `Dockerfile` (PLAN §6.5): `FROM python:3.12-slim`, then
  `apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 curl && rm -rf /var/lib/apt/lists/*`.
  `WORKDIR /app`. Copy `requirements.txt`, `pip install --no-cache-dir -r requirements.txt`, then copy `scripts/`
  and run `scripts/download_model.sh /app/models`. Copy `app/`. Set
  `ENV MODEL_PATH=/app/models/face_landmarker.task`. Use the shell form so `$PORT` expands:
  `CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`. Use explicit `COPY` paths
  (no `.dockerignore` needed).
- `.env.example` (PLAN §8): `SCORER_API_KEY=dev-scorer-key`, `MODEL_PATH=/app/models/face_landmarker.task`,
  `MAX_IMAGE_BYTES=5000000`.
- `pyproject.toml`: tool config only, with no `[project]` packaging. Include `[tool.ruff] line-length = 100`,
  `target-version = "py312"`, `[tool.ruff.lint] select = ["E","F","I","B","UP"]`, and
  `[tool.pytest.ini_options] pythonpath = ["."]`, `testpaths = ["tests"]`.
- `tests/conftest.py`: `os.environ["SCORER_API_KEY"] = "test-key"` at the top, before any app import. Use an
  assignment, not `setdefault` **(audit)**: `docker compose run scorer` inherits `SCORER_API_KEY=dev-scorer-key`
  from the compose env, and the tests must use the same key everywhere.
  `tests/test_health.py` checks that `TestClient(app).get("/health")` returns 200 and `status == "ok"`.
- Root `.gitignore`: `.env`, `.env.*`, `!.env.example`, `node_modules/`, `.next/`, `apps/web/.data/`,
  `__pycache__/`, `*.pyc`, `.venv/`, `.pytest_cache/`, `.ruff_cache/`, `apps/scorer/models/`, `*.task`,
  `coverage/`, `.DS_Store`.
- Root `docker-compose.yml`:
  - `db`: `postgres:16`, env `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=postgres`, `POSTGRES_DB=smile`, port
    `5432:5432`, a named volume, and a `pg_isready` healthcheck.
  - `scorer`: `build: ./apps/scorer`, port `8000:8000`, env `SCORER_API_KEY=dev-scorer-key` and
    `MAX_IMAGE_BYTES=5000000`.

## Do not
- Touch files outside the `files` list. If you must, stop and report why.
- Use `mediapipe.solutions` or anything from pre-Tasks tutorials.
- Commit the model file, or anything under `.venv`.
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app/apps/scorer
uv venv --python 3.12 .venv && uv pip install --python .venv -r requirements-dev.txt
./scripts/download_model.sh models && test -s models/face_landmarker.task
.venv/bin/python -c "from mediapipe.tasks.python import vision; print('ok')"
.venv/bin/ruff check . && .venv/bin/ruff format --check . && .venv/bin/pytest -q
cd .. && cd .. && docker compose build scorer && docker compose up -d && sleep 5 && curl -sf localhost:8000/health
docker compose exec scorer python -c "import mediapipe, cv2; print('imports ok')"   # proves libGL is present
git status --porcelain | grep -E '\.task|\.venv' && echo "IGNORED FILES LEAKED" || echo clean
```
- `/health` returns `{"status":"ok","model_loaded":false}` locally and in Docker.
