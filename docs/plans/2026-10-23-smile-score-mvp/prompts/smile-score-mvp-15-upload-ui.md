---
type: prompt
plan: "[[2026-10-23-smile-score-mvp]]"
id: 15
unit:
status: todo
model: sonnet
effort: high
depends_on: [14]
parallel_group:
files:
  create: [apps/web/src/lib/downscale.ts, apps/web/src/components/upload-form.tsx, apps/web/src/components/history-grid.tsx, apps/web/tests/downscale.test.ts]
  modify: ["apps/web/src/app/(app)/dashboard/page.tsx"]
  delete: []
---
# 15 · Client downscale, upload form, history grid, dashboard

## Task
Build the dashboard: an upload card (pick a file, preview, downscale in the browser, submit, loading state, friendly
errors) and a server-rendered grid of the user's past uploads.

## Context
- Repo: `/home/apa/Code/smile-score-app/apps/web`. Available: `POST /api/uploads` (field `image`; returns 201 `{id}`
  or `{error: code}` with 401/413/415/422/500/503), `GET /api/uploads/[id]/image` (owner-checked),
  `listUploadsForUser(userId)` in `src/lib/uploads.ts` (returns `id`, `smileScore`, `createdAt`), `requireSession()`,
  and `uploadErrorMessages`, `UploadErrorCode`, `uploadErrorCodes`, `ALLOWED_IMAGE_TYPES` and `MAX_RAW_FILE_BYTES`
  from `src/lib/validation.ts`. The shadcn `button` and `card` exist. Spec: PLAN.md §2.1.1, §7.2, §7.5.
- `src/lib/downscale.ts` (browser):
  ```ts
  export const MAX_EDGE = 1600;
  export function fitWithin(w: number, h: number, max = MAX_EDGE): { width: number; height: number }  // pure; never enlarges; rounds
  export class DecodeError extends Error {}
  export async function downscaleToJpeg(file: File): Promise<Blob>
    // createImageBitmap(file, { imageOrientation: "from-image" }) — catch -> throw DecodeError (HEIC in Chrome etc.)
    // canvas sized by fitWithin, drawImage, bitmap.close(), canvas.toBlob(cb, "image/jpeg", 0.9) as a Promise
  ```
- `src/components/upload-form.tsx` (`"use client"`):
  - `<input type="file" accept="image/jpeg,image/png,image/webp">`, with a visible label.
  - On select: if `file.size > MAX_RAW_FILE_BYTES`, show `too_large`. If the type isn't in `ALLOWED_IMAGE_TYPES`,
    show `unsupported_image`. Otherwise downscale (a `DecodeError` shows `unsupported_image`) and preview the result
    with `URL.createObjectURL`. Revoke the old URL on change and on unmount.
  - Submit: `FormData` with `image` set to the downscaled blob (`"photo.jpg"`), then `fetch("/api/uploads", { method: "POST", body })`.
    On 201, `router.push(\`/results/${id}\`)`. Otherwise parse the JSON `error`, and if it's in `uploadErrorCodes`,
    show its message. **A 413 with a non-JSON body (Vercel's own limit) shows `too_large`.** A 401 shows
    `unauthorized`. Anything else, or a network failure, shows `upload_failed`.
  - The loading state ("Scoring…") disables the input and the button. Show the error in `role="alert"`.
  - Under the button, a muted consent line: "Your photo is stored privately and used only to compute your smile
    score." This is a plan decision: a compliance mitigation for face data.
- `src/components/history-grid.tsx` (a **server component**, no `"use client"`): props `{ items: { id; smileScore;
  createdAt }[] }`. A responsive grid of cards, each linking to `/results/{id}`: a thumbnail, the score and the date
  (`toLocaleDateString`). The thumbnail is a **plain `<img src="/api/uploads/{id}/image" loading="lazy">`**, not
  `next/image` (the optimizer fetches without the user's cookies, so it would 404 or cache a private image). Add an
  `// eslint-disable-next-line @next/next/no-img-element` comment with that reason. Show an empty state when there are
  no uploads.
- `dashboard/page.tsx`: `const session = await requireSession(); const items = await listUploadsForUser(session.user.id)`.
  Render `<UploadForm />` in a card, then `<HistoryGrid items={items} />`.
- `tests/downscale.test.ts`: `fitWithin` cases: 4000×3000 → 1600×1200, 3000×4000 → 1200×1600, 800×600 unchanged,
  1601×1 → 1600×1.

## Do not
- Touch files outside the `files` list. If you must, stop and report why.
- Upload the original file. Always send the downscaled JPEG.
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app/apps/web
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
- In `pnpm dev` with docker compose up: a smiling photo navigates to `/results/{id}` (that page arrives in 16; a 404
  is fine for now). The no-face, two-face and `.txt`-renamed-`.jpg` cases, and a file over 25 MB, each show their
  message. The history shows the new upload's thumbnail.
