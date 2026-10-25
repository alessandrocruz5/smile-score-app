---
type: prompt
plan: "[[2026-10-23-smile-score-mvp]]"
id: 19
unit:
status: done
model: sonnet
effort: medium
depends_on: [18, 06]
parallel_group:
files:
  create: [.github/workflows/ci.yml]
  modify: []
  delete: []
---
# 19 · GitHub Actions CI

## Task
Add one CI workflow with two jobs. **web** runs lint, typecheck and test. **scorer** runs ruff and pytest, with the
model file cached.

## Context
- Repo: `/home/apa/Code/smile-score-app`, with `apps/web` (pnpm, `pnpm-lock.yaml`, scripts `lint`, `typecheck`,
  `test`, `engines.node >=24`) and `apps/scorer` (`requirements-dev.txt`, `pyproject.toml` with ruff and pytest,
  `scripts/download_model.sh <dir>`, `MODEL_PATH` env, tests that skip when the model or the owner fixtures are
  missing). Spec: PLAN.md §10 Phase 4.
- Triggers: `push` to `main` and `pull_request`. Add `concurrency` that cancels in-progress runs for the same ref,
  and `permissions: contents: read`.
- **web** job: `defaults.run.working-directory: apps/web`. Steps: `actions/checkout@v4`, `pnpm/action-setup@v4`
  (if `packageManager` isn't set in package.json, pin the pnpm major you see in `pnpm --version`), then
  `actions/setup-node@v4` with `node-version: 24`, `cache: pnpm` and
  `cache-dependency-path: apps/web/pnpm-lock.yaml`. Then `pnpm install --frozen-lockfile`, `pnpm lint`,
  `pnpm typecheck` and `pnpm test`. No secrets are needed; the tests are pure.
- **scorer** job: `working-directory: apps/scorer`. Steps: checkout, `actions/setup-python@v5` with
  `python-version: "3.12"`, `cache: pip` and `cache-dependency-path: apps/scorer/requirements*.txt`. Then
  `pip install -r requirements-dev.txt`. Use `actions/cache@v4` for `apps/scorer/models`, keyed on
  `hashFiles('apps/scorer/scripts/download_model.sh')`, then `./scripts/download_model.sh models` (it skips when the
  file exists). Then `ruff check .`, `ruff format --check .` and `pytest -q -rs` with
  `env: MODEL_PATH: models/face_landmarker.task`. `SCORER_API_KEY` is set by conftest.
- If `actions/*` majors newer than those above are current, use them, and say which.

## Do not
- Touch files outside the `files` list.
- Add deploy steps or secrets.
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))" 2>/dev/null || npx --yes yaml-lint .github/workflows/ci.yml
(cd apps/web && pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test)
(cd apps/scorer && .venv/bin/ruff check . && .venv/bin/ruff format --check . && MODEL_PATH=models/face_landmarker.task .venv/bin/pytest -q -rs)
```
- After the owner pushes: both jobs are green on GitHub.
