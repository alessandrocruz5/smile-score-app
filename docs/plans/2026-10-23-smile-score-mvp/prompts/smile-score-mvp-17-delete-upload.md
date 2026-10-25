---
type: prompt
plan: "[[2026-10-23-smile-score-mvp]]"
id: 17
unit:
status: done
model: sonnet
effort: high
depends_on: [16]
parallel_group:
files:
  create: ["apps/web/src/app/api/uploads/[id]/route.ts", apps/web/src/components/delete-upload-button.tsx]
  modify: [apps/web/src/lib/uploads.ts, "apps/web/src/app/(app)/results/[id]/page.tsx"]
  delete: []
---
# 17 · Delete an upload: owner-checked `DELETE /api/uploads/[id]` + button

## Task
Let a user delete one of their own uploads. This removes the stored image and the `uploads` row. Add an
owner-scoped delete to the query module, a `DELETE` route handler, and a confirm-then-delete button on the
results page. Anyone else's ID, or a non-UUID, returns 404.

## Context
- Repo: `/home/apa/Code/smile-score-app/apps/web`. Requirement R13 (owner decision, 2026-10-23). It is also the
  plan's main compliance answer: face photos are biometric-adjacent data, and users can now remove theirs.
- Available:
  - `getSession()` in `src/lib/session.ts` (null if there's no session)
  - `src/lib/uploads.ts`: `getUploadForUser(id, userId)` (null for a non-UUID or someone else's ID) and
    `listUploadsForUser(userId)`. **Every read and delete of `uploads` goes through this module,** so the
    `user_id` filter lives in one place.
  - `db` in `src/lib/db/index.ts`, and the `uploads` table in `src/lib/db/schema.ts` (`id`, `userId`,
    `blobPathname`, …)
  - `getStorage()` in `src/lib/storage/index.ts`, which returns `{ put, get, del }`. `del` is idempotent: deleting
    a missing blob or file is a no-op. Call it inside functions, never at module top level.
  - `uploadErrorMessages.unauthorized` in `src/lib/validation.ts`, and the shadcn `button` (it has a
    `destructive` variant)
  - The route-handler pattern to copy: `src/app/api/uploads/[id]/image/route.ts` (Next 16 async `params`, 401
    without a session, **404 not 403** for a foreign ID).
- Add to `src/lib/uploads.ts`:
  ```ts
  export async function deleteUploadForUser(id: string, userId: string): Promise<"deleted" | "not_found">
    // const row = await getUploadForUser(id, userId); if (!row) return "not_found";
    // await getStorage().del(row.blobPathname);          // 1. blob first (a throw propagates)
    // await db.delete(uploads).where(and(eq(uploads.id, id), eq(uploads.userId, userId)));   // 2. then the row
    // return "deleted";
  ```
  Write a comment on the order (a plan decision): the blob goes first, so a failure never leaves a face photo
  stored with no row pointing to it. If the row delete fails afterwards, a retry completes it, because both steps
  are idempotent.
- `src/app/api/uploads/[id]/route.ts`:
  `export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> })`.
  - No session: 401 `{ error: "unauthorized" }`.
  - `"not_found"`: 404 `{ error: "not_found" }` (comment: don't reveal that the ID exists).
  - A throw: `console.error` with the user ID and the upload ID (never a blob URL or a stack to the client), then
    500 `{ error: "delete_failed" }`.
  - `"deleted"`: `new Response(null, { status: 204 })`.
  - Export `DELETE` only. A route handler, not a Server Action, so curl can verify it and it matches the rest of
    the upload API.
- `src/components/delete-upload-button.tsx` (`"use client"`), with props `{ id: string }`. A shadcn `Button`,
  `variant="destructive"`, labelled "Delete photo". On click: `if (!window.confirm("Delete this photo? This can't be
  undone.")) return;`, then `fetch(\`/api/uploads/${id}\`, { method: "DELETE" })`.
  - On 204: `router.push("/dashboard")`, then `router.refresh()`.
  - On 401: show `uploadErrorMessages.unauthorized`.
  - On anything else, or a network failure: show "Couldn't delete this photo. Please try again."
  - Show the error in `role="alert"`, and disable the button while the request runs ("Deleting…").
- `results/[id]/page.tsx`: render `<DeleteUploadButton id={row.id} />` next to the "Back to dashboard" link. Change
  nothing else on the page.

## Do not
- Touch files outside the `files` list. If you must, stop and report why.
- Query or delete from `uploads` outside `src/lib/uploads.ts`.
- Delete the row before the blob.
- Add account deletion (out of scope).
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app/apps/web
pnpm lint && pnpm typecheck && pnpm test && pnpm build
cd ../.. && docker compose up -d && cd apps/web
pnpm dev & DEV=$!; sleep 6
J=$(mktemp -d); R=$(date +%s%N); IMG=../scorer/tests/fixtures/big_smile.jpg   # owner's photo (M1); R: unique emails per run
curl -s -c $J/a -H 'Content-Type: application/json' -d "{\"name\":\"A\",\"email\":\"a17-$R@x.io\",\"password\":\"password1\"}" localhost:3000/api/auth/sign-up/email >/dev/null
curl -s -c $J/b -H 'Content-Type: application/json' -d "{\"name\":\"B\",\"email\":\"b17-$R@x.io\",\"password\":\"password1\"}" localhost:3000/api/auth/sign-up/email >/dev/null
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE localhost:3000/api/uploads/00000000-0000-4000-8000-000000000000   # 401
curl -s -o /dev/null -w '%{http_code}\n' -b $J/b -X DELETE localhost:3000/api/uploads/not-a-uuid                    # 404
if test -f "$IMG"; then
  ID=$(curl -s -b $J/a -F "image=@$IMG;type=image/jpeg" -F consent=true localhost:3000/api/uploads | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
  curl -s -o /dev/null -w '%{http_code}\n' -b $J/b -X DELETE localhost:3000/api/uploads/$ID      # 404 (not B's)
  curl -s -o /dev/null -w '%{http_code}\n' -b $J/a -X DELETE localhost:3000/api/uploads/$ID      # 204
  curl -s -o /dev/null -w '%{http_code}\n' -b $J/a localhost:3000/api/uploads/$ID/image          # 404: gone
  curl -s -o /dev/null -w '%{http_code}\n' -b $J/a -X DELETE localhost:3000/api/uploads/$ID      # 404: already deleted
  find .data/uploads -name "$ID.jpg" | wc -l                                                     # 0: file removed
  docker compose -f ../../docker-compose.yml exec -T db psql -U postgres -d smile -tAc "select count(*) from uploads where id='$ID'"   # 0
else
  echo "owner fixture missing: check the 204 flow by hand in the browser"
fi
kill $DEV; pkill -f 'next dev' || true
```
- In the browser: on a results page, "Delete photo" asks for confirmation, then lands on the dashboard without that
  upload in the history.
