---
type: prompt
plan: "[[2026-10-23-smile-score-mvp]]"
id: 13
unit:
status: todo
model: sonnet
effort: medium
depends_on: [11]
parallel_group:
files:
  create: [apps/web/src/lib/scorer.ts, apps/web/tests/scorer.test.ts]
  modify: []
  delete: []
---
# 13 · Typed scorer client + error-mapping tests

## Task
Write the server-side client that sends a normalized JPEG to the scorer and returns a typed result. Test every
error mapping with a mocked `fetch`.

## Context
- Repo: `/home/apa/Code/smile-score-app/apps/web`. `src/lib/validation.ts` exports `scorerResponseSchema`,
  `ScorerResponse` and `UploadErrorCode`. Spec: PLAN.md §7.4, §6.1 (scorer errors: 401 `unauthorized`, 413
  `too_large`, 415 `unsupported_image`, 422 `no_face` / `multiple_faces`, all as `{"error": code}`).
- `src/lib/scorer.ts` (server only; it reads `SCORER_URL` and `SCORER_API_KEY` at call time):
  ```ts
  export type ScorerErrorCode = Extract<UploadErrorCode,
    "no_face" | "multiple_faces" | "unsupported_image" | "too_large" | "scorer_unavailable">;
  export type ScoreResult = { ok: true; data: ScorerResponse } | { ok: false; code: ScorerErrorCode };
  export async function scoreImage(jpeg: Buffer): Promise<ScoreResult>
  ```
  - `const form = new FormData(); form.append("image", new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), "image.jpg")`
  - `fetch(\`${SCORER_URL}/score\`, { method: "POST", body: form, headers: { "X-Scorer-Key": key }, signal: AbortSignal.timeout(30_000) })`
  - A network error or timeout (catch) maps to `scorer_unavailable`.
  - On 200: `scorerResponseSchema.safeParse(json)`. A failure maps to `scorer_unavailable`, and
    `console.error("scorer contract mismatch", issues)`.
  - Not OK: try to parse `{ error }` from the JSON. `no_face`, `multiple_faces`, `unsupported_image` and `too_large`
    pass through. Anything else (401 is a misconfigured key, 5xx, non-JSON) maps to `scorer_unavailable`, with a
    `console.error` of the status, never the key.
  - If `SCORER_URL` or `SCORER_API_KEY` is missing, return `scorer_unavailable` and `console.error` once.
- `tests/scorer.test.ts`: `vi.stubGlobal("fetch", vi.fn(...))`, and `vi.stubEnv` for the URL and key. Cases: a 200
  with a valid payload is `ok: true`; a 200 with a bad payload is `scorer_unavailable`; a 422 with `no_face` and a
  422 with `multiple_faces` each map to their code; a 415 to `unsupported_image`; a 413 to `too_large`; a 401 to
  `scorer_unavailable`; a 502 with HTML to `scorer_unavailable`; a rejected fetch (`TimeoutError`) to
  `scorer_unavailable`. Also assert the request carries the `X-Scorer-Key` header and an `image` form field.

## Do not
- Touch files outside the `files` list. If you must, stop and report why.
- Import this module from client components.
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app/apps/web
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
