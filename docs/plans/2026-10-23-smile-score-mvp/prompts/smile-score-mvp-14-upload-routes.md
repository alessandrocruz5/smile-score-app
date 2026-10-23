---
type: prompt
plan: "[[2026-10-23-smile-score-mvp]]"
id: 14
unit:
status: todo
model: opus
effort: high
depends_on: [05, 12, 13]
parallel_group:
files:
  create: [apps/web/src/lib/uploads.ts, "apps/web/src/app/api/uploads/[id]/image/route.ts"]
  modify: [apps/web/src/app/api/uploads/route.ts]
  delete: []
---
# 14 · `POST /api/uploads` (score, then store) + owner-checked image route

## Task
Replace the 401 stub with the full upload flow. Add the owner-scoped query module and `GET /api/uploads/[id]/image`,
which streams only the owner's image and returns 404 for anything else.

## Context
- Repo: `/home/apa/Code/smile-score-app/apps/web`. Available:
  - `getSession()` in `src/lib/session.ts` (null if there's no session)
  - `db` in `src/lib/db/index.ts`, and the `uploads` table in `src/lib/db/schema.ts` (camelCase fields:
    `id`, `userId`, `blobPathname`, `width`, `height`, `smileScore`, `components`, `blendshapes`, `overlay`,
    `modelVersion`, `createdAt`)
  - `getStorage()` in `src/lib/storage/index.ts`, which returns a `Storage` (`put`, `get` returning
    `ReadableStream | null`, `del`). Call it inside the handler, never at module top level: it throws on Vercel
    without a Blob token, and an import-time call would fail `next build`.
  - `normalizeImage(buf)` in `src/lib/image.ts` (throws on a non-image, or a real format other than jpeg/png/webp)
  - `scoreImage(jpeg)` in `src/lib/scorer.ts` (returns `ScoreResult`)
  - `ALLOWED_IMAGE_TYPES`, `MAX_UPLOAD_BYTES` and `UploadErrorCode` in `src/lib/validation.ts`

  Spec: PLAN.md §2.1, §2.2, §12.
- `src/lib/uploads.ts`. **Every read of `uploads` goes through here,** so the `user_id` filter lives in one place:
  ```ts
  export async function getUploadForUser(id: string, userId: string)   // row | null
    // if (!z.uuid().safeParse(id).success) return null;  -> avoids a Postgres uuid-cast 500 (a 404, not a 500)
    // where(and(eq(uploads.id, id), eq(uploads.userId, userId))).limit(1)
  export async function listUploadsForUser(userId: string, limit = 50)
    // select id, smileScore, createdAt ... where userId ... orderBy(desc(createdAt)) ... limit
  ```
- `POST /api/uploads` (`src/app/api/uploads/route.ts`). Set `export const runtime = "nodejs"` (sharp needs it).
  Return errors as `Response.json({ error: code }, { status })`:
  1. `getSession()` null: 401 `unauthorized`.
  2. `await req.formData()` (catch: 415 `unsupported_image`). **Consent (R14):** if `form.get("consent") !== "true"`,
     return 400 `consent_required` (comment: consent is enforced on the server, not just by the checkbox, so each
     stored row records consent at its `created_at`). Get `image`. If it isn't a `File`: 415. If its type
     isn't in `ALLOWED_IMAGE_TYPES`: 415. `size > MAX_UPLOAD_BYTES`: 413 `too_large`.
  3. `normalizeImage(Buffer.from(await file.arrayBuffer()))`. A throw is 415 `unsupported_image`.
  4. `scoreImage(normalized.data)`. If not ok: `no_face` / `multiple_faces` are 422, `unsupported_image` is 415,
     `too_large` is 413, and `scorer_unavailable` is 503. **Store nothing** (comment: scoring before storage means
     failed scores leave no orphaned files).
  5. `const id = crypto.randomUUID(); const pathname = \`uploads/${session.user.id}/${id}.jpg\``. Then
     `getStorage().put(pathname, data, "image/jpeg")`. A throw is 500 `upload_failed`.
  6. Insert the row (`id`, `userId: session.user.id`, `blobPathname`, `width`, `height`, `smileScore`,
     `components`, `blendshapes`, `overlay`, `modelVersion`). On a throw, `await getStorage().del(pathname).catch(() => {})`
     (best effort), then 500 `upload_failed`.
  7. `Response.json({ id }, { status: 201 })`.

  Log the failures with `console.error` and the context (the code and the user ID), never the image bytes. **VERIFY**
  in the Vercel docs whether the route needs `export const maxDuration` for a 30 s scorer call on the current plan.
  Set it to 60 only if the default is lower.
- `GET /api/uploads/[id]/image` (`src/app/api/uploads/[id]/image/route.ts`). Next 16 params are async:
  `export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> })`.
  - No session: 401. `getUploadForUser(id, session.user.id)` null: **404, not 403** (comment: don't reveal that the
    ID exists).
  - `getStorage().get(row.blobPathname)` null: 404.
  - `new Response(stream, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-cache",
    "X-Content-Type-Options": "nosniff" } })`.

## Do not
- Touch files outside the `files` list. If you must, stop and report why.
- Use a Server Action for upload (1 MB limit).
- Query `uploads` anywhere except `src/lib/uploads.ts` (reads) and the POST insert.
- Return a blob URL or a stack trace to the client.
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app/apps/web
pnpm lint && pnpm typecheck && pnpm test && pnpm build
cd ../.. && docker compose up -d && cd apps/web
pnpm dev & DEV=$!; sleep 6
J=$(mktemp -d); R=$(date +%s%N)   # unique emails: this block is re-run by build-unit's verify step
curl -s -c $J/a -H 'Content-Type: application/json' -d "{\"name\":\"A\",\"email\":\"a14-$R@x.io\",\"password\":\"password1\"}" localhost:3000/api/auth/sign-up/email >/dev/null
curl -s -c $J/b -H 'Content-Type: application/json' -d "{\"name\":\"B\",\"email\":\"b14-$R@x.io\",\"password\":\"password1\"}" localhost:3000/api/auth/sign-up/email >/dev/null
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/uploads                          # 401
curl -s -b $J/a -F 'image=@../../README.md;type=image/jpeg' localhost:3000/api/uploads              # 400 consent_required (no consent field)
curl -s -b $J/a -F 'image=@../../README.md;type=image/jpeg' -F consent=true localhost:3000/api/uploads   # 415 unsupported_image
node -e "require('sharp')({create:{width:400,height:400,channels:3,background:'#888'}}).jpeg().toFile('$J/flat.jpg')"
curl -s -b $J/a -F "image=@$J/flat.jpg;type=image/jpeg" -F consent=true localhost:3000/api/uploads                  # 422 no_face
ls .data/uploads 2>/dev/null | wc -l                                                                 # 0: nothing stored
curl -s -o /dev/null -w '%{http_code}\n' -b $J/b localhost:3000/api/uploads/not-a-uuid/image         # 404
curl -s -o /dev/null -w '%{http_code}\n' -b $J/b localhost:3000/api/uploads/00000000-0000-4000-8000-000000000000/image  # 404
head -c 5000000 /dev/urandom > $J/big.jpg
curl -s -b $J/a -F "image=@$J/big.jpg;type=image/jpeg" -F consent=true localhost:3000/api/uploads                   # 413 too_large
node -e "require('sharp')({create:{width:50,height:50,channels:3,background:'#888'}}).gif().toFile('$J/x.gif')"
curl -s -b $J/a -F "image=@$J/x.gif;type=image/jpeg" -F consent=true localhost:3000/api/uploads                    # 415 unsupported_image
kill $DEV; pkill -f 'next dev' || true
```
- With a smiling photo (the owner's) and `-F consent=true`: A's POST returns 201 `{id}`. A's GET of `/api/uploads/{id}/image` is 200
  `image/jpeg` with no EXIF. B's GET of the same ID is **404**.
