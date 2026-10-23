---
type: prompt
plan: "[[2026-10-23-smile-score-mvp]]"
id: 16
unit:
status: todo
model: sonnet
effort: high
depends_on: [15]
parallel_group:
files:
  create: [apps/web/src/lib/score-label.ts, apps/web/src/components/score-card.tsx, apps/web/src/components/breakdown-bars.tsx, apps/web/src/components/face-overlay.tsx, "apps/web/src/app/(app)/results/[id]/page.tsx", apps/web/tests/score-label.test.ts]
  modify: []
  delete: []
---
# 16 · Results page: score card, breakdown bars, face overlay

## Task
Build `/results/[id]`. It runs a server-side owner check (otherwise `notFound()`) and shows the photo with an SVG face
overlay, the big score with its label, the breakdown bars and the date.

## Context
- Repo: `/home/apa/Code/smile-score-app/apps/web`. Available: `requireSession()`; `getUploadForUser(id, userId)` in
  `src/lib/uploads.ts` (returns null for a non-UUID or someone else's ID); the `Components` and `Overlay` types in
  `src/lib/validation.ts`; the shadcn `card`. The row fields are `smileScore`, `components` (`{ mouth_smile,
  eye_crinkle, mouth_open }`, each 0–1), `overlay` (`bbox: [x,y,w,h]`, and `lips`, `left_eye`, `right_eye`,
  `face_oval` as arrays of `[x1,y1,x2,y2]` segments, all normalized 0–1), `modelVersion` and `createdAt`. Spec:
  PLAN.md §6.3, §7.5.
- `src/lib/score-label.ts`:
  `export function scoreLabel(score: number): "Neutral" | "Slight smile" | "Smile" | "Big smile"`.
  0–19 is Neutral, 20–44 Slight smile, 45–74 Smile, 75–100 Big smile. UI only, never stored.
- `results/[id]/page.tsx`: `const { id } = await params` (Next 16 params are a Promise). Then
  `const session = await requireSession()`, and `const row = await getUploadForUser(id, session.user.id)`. If there's
  no row, `notFound()`. Layout: a two-column grid on md+, stacked on mobile. On the left is `<FaceOverlay>`; on the
  right, `<ScoreCard score label date>` and `<BreakdownBars components>`, plus a small muted `modelVersion`. Add a
  "Back to dashboard" link.
- `face-overlay.tsx` (a server component is fine): a `relative` wrapper containing
  `<img src="/api/uploads/{id}/image" className="block w-full h-auto">`. Use a plain img, not `next/image`, with the
  eslint-disable comment and its reason (the optimizer fetches without cookies). Over it goes an
  `<svg className="absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>`.
  Draw one `<path>` per feature with `d` built from `M x1 y1 L x2 y2` segments, plus a `<rect>` for the bbox.
  **Every stroke uses `vectorEffect="non-scaling-stroke"` and `strokeWidth={2}`**; otherwise stroke widths are in
  viewBox units and fill the image. Use `fill="none"` and a distinct colour per feature (Tailwind
  `stroke-*` classes or inline colours). The img gets an `alt` like "Your photo with face landmarks".
- `score-card.tsx`: the big number (`text-6xl`, tabular-nums), `scoreLabel(score)` and the formatted date.
- `breakdown-bars.tsx`: three labelled bars (Mouth smile, Eye crinkle, Mouth open), each with a percentage
  (`Math.round(v*100)`), as divs with a width style (no chart library), `role="meter"` and the aria-value attributes.
- `tests/score-label.test.ts`: the boundaries 0, 19, 20, 44, 45, 74, 75 and 100.

## Do not
- Touch files outside the `files` list. If you must, stop and report why.
- Query `uploads` directly. Use `getUploadForUser`.
- Add a chart library.
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app/apps/web
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
- In the browser: an upload lands on its results page, and the overlay lines sit on the lips, eyes and jaw of both
  a landscape photo and a **portrait phone photo**. User B opening A's `/results/{id}`, or `/results/garbage`, gets
  the 404 page.
- Phase 3 "Done when" is then completed by M3 (prod deploy, edge cases, calibration).
