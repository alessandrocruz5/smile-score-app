import { and, asc, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { uploads } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";

// Every read and delete of `uploads` goes through here, so the user_id filter lives in one place (PLAN §12).

/** The upload if it exists and belongs to userId, otherwise null (callers return 404, never 403). */
export async function getUploadForUser(id: string, userId: string) {
  // A non-uuid would make Postgres throw on the uuid cast: treat it as not found (404, not 500).
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await db
    .select()
    .from(uploads)
    .where(and(eq(uploads.id, id), eq(uploads.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** The user's uploads, newest first. */
export async function listUploadsForUser(userId: string, limit = 50) {
  return db
    .select({ id: uploads.id, smileScore: uploads.smileScore, createdAt: uploads.createdAt })
    .from(uploads)
    .where(eq(uploads.userId, userId))
    .orderBy(desc(uploads.createdAt))
    .limit(limit);
}

/** Deletes the user's upload (stored image, then row). "not_found" for a non-uuid or someone else's ID. */
export async function deleteUploadForUser(
  id: string,
  userId: string,
): Promise<"deleted" | "not_found"> {
  const row = await getUploadForUser(id, userId);
  if (!row) return "not_found";
  // Order matters (plan decision): the blob goes first, so a failure never leaves a face photo stored
  // with no row pointing to it. If the row delete fails afterwards, a retry completes it, because both
  // steps are idempotent.
  await getStorage().del(row.blobPathname);
  await db.delete(uploads).where(and(eq(uploads.id, id), eq(uploads.userId, userId)));
  return "deleted";
}

/**
 * Deletes uploads created before `cutoff` (stored image, then row), oldest first, at most `limit` per run.
 * The only cross-user query in this module: a system retention job that never takes user input, so it
 * can't be used to reach another user's data. Same blob-first order as deleteUploadForUser, so a failed
 * run leaves nothing unreachable and the next day's run retries it. No index on created_at alone: the
 * (user_id, created_at) index doesn't cover this scan, which is fine at this scale.
 */
export async function purgeExpiredUploads(
  cutoff: Date,
  limit = 100,
): Promise<{ deleted: number; failed: number }> {
  const rows = await db
    .select({ id: uploads.id, blobPathname: uploads.blobPathname })
    .from(uploads)
    .where(lt(uploads.createdAt, cutoff))
    .orderBy(asc(uploads.createdAt))
    .limit(limit);
  let deleted = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await getStorage().del(row.blobPathname);
      await db.delete(uploads).where(eq(uploads.id, row.id));
      deleted++;
    } catch {
      // Log the ID only: never a blob pathname or the error (it may carry a URL or token).
      console.error("upload purge failed", { uploadId: row.id });
      failed++;
    }
  }
  return { deleted, failed };
}
