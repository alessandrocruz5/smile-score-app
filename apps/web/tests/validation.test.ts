import { describe, expect, it } from "vitest";
import {
  loginSchema,
  profileSchema,
  registerSchema,
  scorerResponseSchema,
  uploadErrorCodes,
  uploadErrorMessages,
} from "@/lib/validation";

const valid = { name: "Ada", email: "ada@example.com", password: "12345678" };

describe("registerSchema", () => {
  it("accepts valid input", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects a 7-character password", () => {
    expect(registerSchema.safeParse({ ...valid, password: "1234567" }).success).toBe(false);
  });
  it("rejects a bad email", () => {
    expect(registerSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
  });
  it("rejects an empty name", () => {
    expect(registerSchema.safeParse({ ...valid, name: "  " }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid input", () => {
    expect(loginSchema.safeParse({ email: valid.email, password: "x" }).success).toBe(true);
  });
});

describe("profileSchema", () => {
  it("trims whitespace", () => {
    const r = profileSchema.safeParse({ name: "  Ada  " });
    expect(r.success && r.data.name).toBe("Ada");
  });
  it("rejects an empty name", () => {
    expect(profileSchema.safeParse({ name: "   " }).success).toBe(false);
  });
});

describe("scorerResponseSchema", () => {
  const seg = [0.1, 0.2, 0.3, 0.4];
  const payload = () => ({
    face_count: 1,
    smile_score: 72,
    components: { mouth_smile: 0.8, eye_crinkle: 0.5, mouth_open: 0.1 },
    blendshapes: Object.fromEntries(Array.from({ length: 52 }, (_, i) => [`shape_${i}`, i / 52])),
    overlay: {
      bbox: [0.1, 0.1, 0.5, 0.6],
      lips: [seg, seg],
      left_eye: [seg],
      right_eye: [seg],
      face_oval: [seg, seg, seg],
    },
    model_version: "face_landmarker_v2",
  });

  it("parses a realistic payload", () => {
    expect(scorerResponseSchema.safeParse(payload()).success).toBe(true);
  });
  it("rejects face_count 2", () => {
    expect(scorerResponseSchema.safeParse({ ...payload(), face_count: 2 }).success).toBe(false);
  });
  it("rejects a score of 101", () => {
    expect(scorerResponseSchema.safeParse({ ...payload(), smile_score: 101 }).success).toBe(false);
  });
  it("rejects a coordinate of 1.2", () => {
    const p = payload();
    p.overlay.bbox = [1.2, 0.1, 0.5, 0.6];
    expect(scorerResponseSchema.safeParse(p).success).toBe(false);
  });
  it("rejects a 3-tuple segment", () => {
    const p = payload();
    p.overlay.lips = [[0.1, 0.2, 0.3]];
    expect(scorerResponseSchema.safeParse(p).success).toBe(false);
  });
});

describe("uploadErrorMessages", () => {
  it("has a message for every code", () => {
    for (const code of uploadErrorCodes) {
      expect(uploadErrorMessages[code]).toBeTruthy();
    }
  });
});
