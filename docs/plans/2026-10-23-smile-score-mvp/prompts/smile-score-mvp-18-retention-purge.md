---
type: prompt
plan: "[[2026-10-23-smile-score-mvp]]"
id: 18
unit:
status: done
model: sonnet
effort: high
depends_on: [17]
parallel_group:
files:
  create: [apps/web/src/lib/cron.ts, apps/web/tests/cron.test.ts, apps/web/src/app/api/cron/purge/route.ts, apps/web/vercel.json]
  modify: [apps/web/src/lib/uploads.ts, apps/web/.env.example]
  delete: []
---
# 18 · Photo retention: daily purge of uploads older than 30 days (Vercel Cron)

## Task
Delete uploads automatically once they're older than `PHOTO_RETENTION_DAYS` (30): the stored image first, then the
row. A daily Vercel Cron job calls a secret-protected route that does it. This is the retention half of R14: the
consent text in the upload form promises it.

## Context
- Repo: `/home/apa/Code/smile-score-app/apps/web`. Available:
  - `PHOTO_RETENTION_DAYS` (30) in `src/lib/validation.ts`. The upload form's consent text uses the same constant,
    so never hard-code 30 anywhere else.
  - `src/lib/uploads.ts`: `getUploadForUser`, `listUploadsForUser` and `deleteUploadForUser` (prompt 17, which
    deletes the blob first, then the row). `db`, plus the `uploads` table (`id`, `blobPathname`, `createdAt`, …).
  - `getStorage()` in `src/lib/storage/index.ts`. Its `del` is idempotent. Call it inside functions only.
- **VERIFY in the current Vercel docs:**
  1. The `vercel.json` `crons` syntax.
  2. That Vercel sends `Authorization: Bearer <CRON_SECRET>` when the project has a `CRON_SECRET` env var.
  3. The Hobby-plan cron limits (expected: once a day at most, with timing precise only to the hour).
  4. That crons run only on production deployments.

  Report what you found.
- `apps/web/vercel.json`: `{ "crons": [{ "path": "/api/cron/purge", "schedule": "0 3 * * *" }] }`. The Vercel
  project's root directory is `apps/web`, so the file lives there. Daily, because Hobby allows nothing more frequent.
- `src/lib/cron.ts` (pure, so it can be unit-tested):
  ```ts
  import { timingSafeEqual } from "node:crypto";
  export function isCronAuthorized(authHeader: string | null, secret: string | undefined): boolean
    // false when !secret (fail closed, like the scorer key); compare `Bearer ${secret}` with timingSafeEqual,
    // returning false first when the byte lengths differ (timingSafeEqual throws on unequal lengths)
  export function retentionCutoff(now: Date, days = PHOTO_RETENTION_DAYS): Date
    // new Date(now.getTime() - days * 86_400_000): rows created strictly before this are expired
  ```
- Add to `src/lib/uploads.ts`:
  ```ts
  export async function purgeExpiredUploads(cutoff: Date, limit = 100): Promise<{ deleted: number; failed: number }>
    // select id, blobPathname where lt(uploads.createdAt, cutoff) orderBy asc(createdAt) limit
    // for each row, sequentially: await getStorage().del(row.blobPathname); then
    //   await db.delete(uploads).where(eq(uploads.id, row.id)); deleted++
    // on a throw: console.error the upload id (nothing else), failed++, continue with the next row
  ```
  Comment it as **the only cross-user query in this module**: a system retention job that never takes user
  input, so it can't be used to reach another user's data. It uses the same blob-first order as
  `deleteUploadForUser`, so a failed run leaves nothing unreachable, and the next day's run retries it. The
  `limit` bounds one run; daily volume is tiny. Don't add an index (the existing `(user_id, created_at)` index
  doesn't cover this scan, which is fine at this scale; a comment says so).
- `src/app/api/cron/purge/route.ts`: `export async function GET(req: Request)`.
  - `isCronAuthorized(req.headers.get("authorization"), process.env.CRON_SECRET)` false: 401
    `{ error: "unauthorized" }`. Read the env at call time.
  - Otherwise `Response.json(await purgeExpiredUploads(retentionCutoff(new Date())))` with status 200.
  - Export `GET` only. Never log the secret or the header.
- `.env.example`: add, with the same comment style as the other lines:
  `CRON_SECRET=                                                     # openssl rand -hex 32; Vercel sends it to /api/cron/purge`
- `tests/cron.test.ts`:
  - `isCronAuthorized`:
    - the right bearer → true
    - a wrong one, the right one without `Bearer `, a different length, and `null` → false
    - an `undefined` or empty secret → false for any header
  - `retentionCutoff`:
    - `retentionCutoff(new Date("2026-11-30T00:00:00Z"), 30)` is `2026-10-31T00:00:00Z`
    - the default uses `PHOTO_RETENTION_DAYS`
    - the cutoff is earlier than `now` (this guards against the comparison flipping and deleting new photos)

## Do not
- Touch files outside the `files` list. If you must, stop and report why.
- Query `uploads` outside `src/lib/uploads.ts`, or delete a row before its blob.
- Add a dependency, a migration, or an env var for the retention period (it's the shared constant).
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app/apps/web
pnpm lint && pnpm typecheck && pnpm test && pnpm build
cd ../.. && docker compose up -d && cd apps/web
CRON_SECRET=local-cron-test pnpm dev & DEV=$!; sleep 6        # an explicit env var wins over .env.local
P=localhost:3000/api/cron/purge
curl -s -o /dev/null -w '%{http_code}\n' $P                                                # 401
curl -s -o /dev/null -w '%{http_code}\n' -H 'Authorization: Bearer wrong' $P               # 401
curl -s -H 'Authorization: Bearer local-cron-test' $P                                      # 200 {"deleted":0,"failed":0} (recent rows survive)
J=$(mktemp -d); R=$(date +%s%N); IMG=../scorer/tests/fixtures/big_smile.jpg; Q="docker compose -f ../../docker-compose.yml exec -T db psql -U postgres -d smile -tAc"
if test -f "$IMG"; then
  curl -s -c $J/a -H 'Content-Type: application/json' -d "{\"name\":\"A\",\"email\":\"a18-$R@x.io\",\"password\":\"password1\"}" localhost:3000/api/auth/sign-up/email >/dev/null
  up() { curl -s -b $J/a -F "image=@$IMG;type=image/jpeg" -F consent=true localhost:3000/api/uploads | node -pe 'JSON.parse(require("fs").readFileSync(0)).id'; }
  OLD=$(up); NEW=$(up)
  $Q "update uploads set created_at = now() - interval '31 days' where id='$OLD'"
  curl -s -H 'Authorization: Bearer local-cron-test' $P                                    # {"deleted":1,"failed":0}
  curl -s -o /dev/null -w '%{http_code}\n' -b $J/a localhost:3000/api/uploads/$OLD/image   # 404: purged
  curl -s -o /dev/null -w '%{http_code}\n' -b $J/a localhost:3000/api/uploads/$NEW/image   # 200: recent photo kept
  find .data/uploads -name "$OLD.jpg" | wc -l                                              # 0
  $Q "select count(*) from uploads where id='$OLD'"                                        # 0
else
  echo "owner fixture missing: the aged-row check needs one face photo"
fi
kill $DEV; pkill -f 'next dev' || true
```
- After deploy (owner, M3): the Vercel dashboard's Cron Jobs tab lists `/api/cron/purge` daily.
