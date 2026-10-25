import {
  scorerResponseSchema,
  type ScorerResponse,
  type UploadErrorCode,
} from "@/lib/validation";

// Server only: reads SCORER_URL and SCORER_API_KEY at call time. Never import from a client component.
export type ScorerErrorCode = Extract<
  UploadErrorCode,
  "no_face" | "multiple_faces" | "unsupported_image" | "too_large" | "scorer_unavailable"
>;

export type ScoreResult =
  | { ok: true; data: ScorerResponse }
  | { ok: false; code: ScorerErrorCode };

const PASS_THROUGH = new Set<string>(["no_face", "multiple_faces", "unsupported_image", "too_large"]);
const unavailable: ScoreResult = { ok: false, code: "scorer_unavailable" };

/** Sends a normalized JPEG to the scorer and maps every failure to a ScorerErrorCode. */
export async function scoreImage(jpeg: Buffer): Promise<ScoreResult> {
  const url = process.env.SCORER_URL;
  const key = process.env.SCORER_API_KEY;
  if (!url || !key) {
    console.error("scorer not configured: SCORER_URL or SCORER_API_KEY is missing");
    return unavailable;
  }

  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), "image.jpg");

  let res: Response;
  try {
    res = await fetch(`${url}/score`, {
      method: "POST",
      body: form,
      headers: { "X-Scorer-Key": key },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    console.error("scorer request failed", err instanceof Error ? err.name : "unknown");
    return unavailable;
  }

  if (res.ok) {
    const parsed = scorerResponseSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) {
      console.error("scorer contract mismatch", parsed.error.issues);
      return unavailable;
    }
    return { ok: true, data: parsed.data };
  }

  const body: unknown = await res.json().catch(() => null);
  const error =
    body && typeof body === "object" && "error" in body ? (body as { error: unknown }).error : null;
  if (typeof error === "string" && PASS_THROUGH.has(error)) {
    return { ok: false, code: error as ScorerErrorCode };
  }
  console.error("scorer returned an unexpected status", res.status);
  return unavailable;
}
