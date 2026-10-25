import { db } from "@/lib/db";
import { uploads } from "@/lib/db/schema";
import { normalizeImage } from "@/lib/image";
import { scoreImage, type ScorerErrorCode } from "@/lib/scorer";
import { getSession } from "@/lib/session";
import { getStorage } from "@/lib/storage";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, type UploadErrorCode } from "@/lib/validation";

// sharp needs the Node.js runtime. That's the default, and `export const runtime` is rejected with
// cacheComponents ("Route segment config "runtime" is not compatible"), so it isn't declared here.
// No maxDuration: with Fluid compute the Hobby default is 300s, well above the scorer's 30s timeout.

const SCORER_STATUS: Record<ScorerErrorCode, number> = {
  no_face: 422,
  multiple_faces: 422,
  unsupported_image: 415,
  too_large: 413,
  scorer_unavailable: 503,
};

// Message only: never log the request or the image bytes.
function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "unknown";
}

function fail(error: UploadErrorCode, status: number) {
  return Response.json({ error }, { status });
}

// A Route Handler, not a Server Action: Server Actions cap the body at 1 MB.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return fail("unauthorized", 401);
  const userId = session.user.id;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("unsupported_image", 415);
  }

  // Consent is enforced on the server, not just by the checkbox, so each stored row records consent
  // at its created_at (R14).
  if (form.get("consent") !== "true") return fail("consent_required", 400);

  const file = form.get("image");
  if (!(file instanceof File)) return fail("unsupported_image", 415);
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return fail("unsupported_image", 415);
  }
  if (file.size > MAX_UPLOAD_BYTES) return fail("too_large", 413);

  let normalized: Awaited<ReturnType<typeof normalizeImage>>;
  try {
    normalized = await normalizeImage(Buffer.from(await file.arrayBuffer()));
  } catch {
    console.error("upload normalize failed", { code: "unsupported_image", userId });
    return fail("unsupported_image", 415);
  }

  // Scoring before storage means failed scores leave no orphaned files: store nothing on failure.
  const score = await scoreImage(normalized.data);
  if (!score.ok) {
    console.error("upload scoring failed", { code: score.code, userId });
    return fail(score.code, SCORER_STATUS[score.code]);
  }

  const id = crypto.randomUUID();
  const pathname = `uploads/${userId}/${id}.jpg`;
  try {
    await getStorage().put(pathname, normalized.data, "image/jpeg");
  } catch (err) {
    console.error("upload storage failed", {
      code: "upload_failed",
      userId,
      error: errorMessage(err),
    });
    return fail("upload_failed", 500);
  }

  const { data } = score;
  try {
    await db.insert(uploads).values({
      id,
      userId,
      blobPathname: pathname,
      width: normalized.width,
      height: normalized.height,
      smileScore: data.smile_score,
      components: data.components,
      blendshapes: data.blendshapes,
      overlay: data.overlay,
      modelVersion: data.model_version,
    });
  } catch (err) {
    console.error("upload insert failed", {
      code: "upload_failed",
      userId,
      error: errorMessage(err),
    });
    // Best effort: don't leave a file without a row.
    await getStorage()
      .del(pathname)
      .catch(() => {});
    return fail("upload_failed", 500);
  }

  return Response.json({ id }, { status: 201 });
}
