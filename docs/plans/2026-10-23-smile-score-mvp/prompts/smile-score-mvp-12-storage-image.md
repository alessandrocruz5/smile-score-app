---
type: prompt
plan: "[[2026-10-23-smile-score-mvp]]"
id: 12
unit:
status: todo
model: sonnet
effort: high
depends_on: [11]
parallel_group:
files:
  create: [apps/web/src/lib/storage/index.ts, apps/web/src/lib/storage/blob.ts, apps/web/src/lib/storage/disk.ts, apps/web/src/lib/image.ts, apps/web/tests/storage.test.ts, apps/web/tests/image.test.ts]
  modify: [apps/web/package.json]
  delete: []
---
# 12 · Storage adapters (private Vercel Blob + local disk) + sharp normalization

## Task
Add the storage abstraction with a **private** Vercel Blob adapter and a local disk adapter, and the sharp
normalization helper. Unit-test the disk adapter and the normalization.

## Context
- Repo: `/home/apa/Code/smile-score-app/apps/web`. Spec: PLAN.md §2.1.3, §7.3, §11 #10 and #12.
- `pnpm add @vercel/blob sharp`. `@vercel/blob` must be ≥ 2.3. If pnpm reports ignored build scripts for sharp,
  approve them.
- **VERIFY the `@vercel/blob` private-store API** (it launched in beta in February 2026) in the current docs: the
  `put(pathname, body, { access: "private", contentType, addRandomSuffix: false })` options, how a private blob
  is read back as a stream (`get(...)` and its return shape), and `del(pathname)`. Report the exact calls you used.
- `src/lib/storage/index.ts`:
  ```ts
  export interface Storage {
    put(pathname: string, data: Buffer, contentType: string): Promise<void>;
    get(pathname: string): Promise<ReadableStream | null>;   // null when missing
    del(pathname: string): Promise<void>;
  }
  ```
  Pick the adapter once: `BLOB_READ_WRITE_TOKEN` set selects `blobStorage`. Otherwise, **if
  `process.env.VERCEL` is set, throw** `"BLOB_READ_WRITE_TOKEN is required on Vercel"` (Vercel's disk doesn't
  persist). Otherwise use `diskStorage`. Export it as `export const storage: Storage`.
- `blob.ts`: `access: "private"` on both put and get. `get` returns `null` on not-found (catch the SDK's not-found
  error). Never return or log a blob URL to the client.
- `disk.ts`: the root is `path.join(process.cwd(), ".data")` (gitignored). The full path is
  `path.resolve(root, pathname)`, and it must start with `root + path.sep`, otherwise throw (a path-traversal
  guard). `put` does `mkdir -p` then writes the file. `get` uses `Readable.toWeb(fs.createReadStream(...))`, or
  returns `null` on `ENOENT`. `del` uses `fs.rm(..., { force: true })`. Export a factory
  `createDiskStorage(root: string)` for tests, plus `diskStorage = createDiskStorage(<default root>)`.
- `src/lib/image.ts`:
  ```ts
  export async function normalizeImage(input: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
    const { data, info } = await sharp(input, { limitInputPixels: 50_000_000 })
      .rotate()                                             // apply EXIF orientation
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })                                // re-encode strips EXIF/GPS
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  }
  ```
  Callers treat a throw as `unsupported_image`. Say so in the doc comment.
- `tests/storage.test.ts`: in a `fs.mkdtemp` temp root, put, get (read the stream back, the bytes match), del, then
  get returns null. `put("../escape.jpg")` rejects.
- `tests/image.test.ts`: generate the inputs with sharp itself. A 3000×2000 PNG becomes a JPEG of 1600×1067. An
  800×600 image isn't enlarged. An input carrying EXIF (`.withMetadata({ orientation: 6 })`) comes back with no
  EXIF (`sharp(out).metadata()` has `exif` undefined) and with its width and height swapped. `Buffer.from("hello")`
  rejects.

## Do not
- Touch files outside the `files` list. If you must, stop and report why.
- Use `access: "public"` anywhere.
- Create or switch branches, commit, or push.

## Done when
```bash
cd /home/apa/Code/smile-score-app/apps/web
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
