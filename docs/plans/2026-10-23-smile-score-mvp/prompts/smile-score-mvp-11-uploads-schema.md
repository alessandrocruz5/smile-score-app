---
type: prompt
plan: "[[2026-10-23-smile-score-mvp]]"
id: 11
unit:
status: todo
model: sonnet
effort: medium
depends_on: [10]
parallel_group:
files:
  create: ["apps/web/drizzle/0001_*.sql (+ drizzle/meta)"]
  modify: [apps/web/src/lib/db/schema.ts, apps/web/src/lib/validation.ts, apps/web/tests/validation.test.ts]
  delete: []
---
# 11 · `uploads` table + migration, scorer-contract and error-code zod schemas

## Task
Add the `uploads` table and its migration, plus the zod schemas for the scorer's response (the cross-service
contract), the upload error codes and their friendly copy.

## Context
- Repo: `/home/apa/Code/smile-score-app/apps/web`. `src/lib/db/schema.ts` holds the generated Better Auth tables
  (`user` with a text `id`, and so on). `src/lib/validation.ts` holds the auth and profile schemas. Spec: PLAN.md
  §5.2, §6.1, §7.6.
- **The `uploads` table** (Drizzle `pg-core`), appended to `schema.ts`:
  | Column | Drizzle |
  |---|---|
  | `id` | `uuid("id").primaryKey().defaultRandom()` (the route supplies its own `crypto.randomUUID()`) |
  | `userId` | `text("user_id").notNull().references(() => user.id, { onDelete: "cascade" })` |
  | `blobPathname` | `text("blob_pathname").notNull()` (`uploads/{userId}/{uuid}.jpg`) |
  | `width`, `height` | `integer(...).notNull()` (after normalization) |
  | `smileScore` | `integer("smile_score").notNull()` plus `check("uploads_smile_score_range", sql\`... between 0 and 100\`)` |
  | `components` | `jsonb("components").$type<Components>().notNull()` |
  | `blendshapes` | `jsonb("blendshapes").$type<Record<string, number>>().notNull()` |
  | `overlay` | `jsonb("overlay").$type<Overlay>().notNull()` |
  | `modelVersion` | `text("model_version").notNull()` |
  | `createdAt` | `timestamp("created_at", { withTimezone: true }).notNull().defaultNow()` |

  Add the index `index("uploads_user_created_idx").on(t.userId, t.createdAt.desc())`. Import the `Components` and
  `Overlay` types from `@/lib/validation` (types only), or use relative imports if drizzle-kit can't resolve `@/`.
- **Add to `validation.ts`.** This mirrors the scorer's Pydantic `ScoreResponse` exactly; keep the field names
  snake_case:
  ```ts
  const unit = z.number().min(0).max(1);
  const segment = z.tuple([unit, unit, unit, unit]);          // x1, y1, x2, y2 (plan decision: segments)
  export const componentsSchema = z.object({ mouth_smile: unit, eye_crinkle: unit, mouth_open: unit });
  export const overlaySchema = z.object({
    bbox: z.tuple([unit, unit, unit, unit]),                  // x, y, w, h
    lips: z.array(segment), left_eye: z.array(segment), right_eye: z.array(segment), face_oval: z.array(segment),
  });
  export const scorerResponseSchema = z.object({
    face_count: z.literal(1), smile_score: z.number().int().min(0).max(100),
    components: componentsSchema, blendshapes: z.record(z.string(), z.number()),
    overlay: overlaySchema, model_version: z.string().min(1),
  });
  export type Components = z.infer<...>; export type Overlay = z.infer<...>; export type ScorerResponse = z.infer<...>;

  export const uploadErrorCodes = ["no_face", "multiple_faces", "unsupported_image", "too_large",
    "scorer_unavailable", "upload_failed", "unauthorized"] as const;
  export type UploadErrorCode = (typeof uploadErrorCodes)[number];
  export const uploadErrorMessages: Record<UploadErrorCode, string> = {
    no_face: "We couldn't find a face. Try a well-lit, front-facing photo.",
    multiple_faces: "We found more than one face. Please upload a photo of just one person.",
    unsupported_image: "That file isn't a supported image. Use JPEG, PNG or WebP.",
    too_large: "That image is too large.",
    scorer_unavailable: "Scoring is temporarily unavailable. Please try again in a minute.",
    upload_failed: "Something went wrong saving your photo. Please try again.",
    unauthorized: "Your session has expired. Please log in again.",
  };
  export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
  export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;            // server, after client downscale
  export const MAX_RAW_FILE_BYTES = 25 * 1024 * 1024;         // client, before decoding
  ```
  Comment the coupling: `scorerResponseSchema` must match `apps/scorer/app/schemas.py`.
- Then run `pnpm db:generate` (it creates `drizzle/0001_*.sql`) and `pnpm db:migrate`.
- Extend `tests/validation.test.ts`: a realistic scorer payload (52 blendshapes, a few segments) parses. `face_count: 2`,
  a score of 101, a coordinate of 1.2 and a 3-tuple segment are each rejected. Every `uploadErrorCodes` entry has
  a message.

## Do not
- Touch files outside the `files` list. If you must, stop and report why.
- Edit the generated Better Auth tables.
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app/apps/web
pnpm db:migrate && pnpm lint && pnpm typecheck && pnpm test && pnpm build
docker compose -f ../../docker-compose.yml exec db psql -U postgres -d smile -c '\d uploads'   # columns, FK cascade, index, check
```
