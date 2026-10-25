import { z } from "zod";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Enter your password"),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
});

export const registerSchema = z.object({
  name: profileSchema.shape.name,
  email: z.email(),
  password: z.string().min(8, "At least 8 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;

// Cross-service contract: scorerResponseSchema must match the Pydantic ScoreResponse in
// apps/scorer/app/schemas.py. Keep field names snake_case.
const unit = z.number().min(0).max(1);
const segment = z.tuple([unit, unit, unit, unit]); // x1, y1, x2, y2

export const componentsSchema = z.object({
  mouth_smile: unit,
  eye_crinkle: unit,
  mouth_open: unit,
});

export const overlaySchema = z.object({
  bbox: z.tuple([unit, unit, unit, unit]), // x, y, w, h
  lips: z.array(segment),
  left_eye: z.array(segment),
  right_eye: z.array(segment),
  face_oval: z.array(segment),
});

export const scorerResponseSchema = z.object({
  face_count: z.literal(1),
  smile_score: z.number().int().min(0).max(100),
  components: componentsSchema,
  blendshapes: z.record(z.string(), z.number()),
  overlay: overlaySchema,
  model_version: z.string().min(1),
});

export type Components = z.infer<typeof componentsSchema>;
export type Overlay = z.infer<typeof overlaySchema>;
export type ScorerResponse = z.infer<typeof scorerResponseSchema>;

export const uploadErrorCodes = [
  "no_face",
  "multiple_faces",
  "unsupported_image",
  "too_large",
  "scorer_unavailable",
  "upload_failed",
  "unauthorized",
  "consent_required",
] as const;
export type UploadErrorCode = (typeof uploadErrorCodes)[number];

export const uploadErrorMessages: Record<UploadErrorCode, string> = {
  no_face: "We couldn't find a face. Try a well-lit, front-facing photo.",
  multiple_faces: "We found more than one face. Please upload a photo of just one person.",
  unsupported_image: "That file isn't a supported image. Use JPEG, PNG or WebP.",
  too_large: "That image is too large.",
  scorer_unavailable: "Scoring is temporarily unavailable. Please try again in a minute.",
  upload_failed: "Something went wrong saving your photo. Please try again.",
  unauthorized: "Your session has expired. Please log in again.",
  consent_required: "Please tick the box to agree to how your photo is stored.",
};

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // server, after client downscale
export const MAX_RAW_FILE_BYTES = 25 * 1024 * 1024; // client, before decoding
export const PHOTO_RETENTION_DAYS = 30; // purge job (18) + consent text (15) share this
