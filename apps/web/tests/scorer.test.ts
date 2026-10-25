import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scoreImage } from "@/lib/scorer";

const payload = {
  face_count: 1,
  smile_score: 72,
  components: { mouth_smile: 0.8, eye_crinkle: 0.5, mouth_open: 0.2 },
  blendshapes: { mouthSmileLeft: 0.7 },
  overlay: {
    bbox: [0.1, 0.1, 0.5, 0.5],
    lips: [[0.1, 0.1, 0.2, 0.2]],
    left_eye: [],
    right_eye: [],
    face_oval: [],
  },
  model_version: "test-1",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

function mockFetch(impl: () => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("scoreImage", () => {
  beforeEach(() => {
    vi.stubEnv("SCORER_URL", "http://scorer.test");
    vi.stubEnv("SCORER_API_KEY", "secret-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns the parsed data on a valid 200", async () => {
    mockFetch(async () => json(payload, 200));
    const result = await scoreImage(jpeg);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.smile_score).toBe(72);
  });

  it("sends the key header and an image form field", async () => {
    const fn = mockFetch(async () => json(payload, 200));
    await scoreImage(jpeg);
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://scorer.test/score");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["X-Scorer-Key"]).toBe("secret-key");
    expect((init.body as FormData).get("image")).toBeInstanceOf(Blob);
  });

  it("maps a 200 with a bad payload to scorer_unavailable", async () => {
    mockFetch(async () => json({ smile_score: "high" }, 200));
    expect(await scoreImage(jpeg)).toEqual({ ok: false, code: "scorer_unavailable" });
  });

  it.each([
    [422, "no_face"],
    [422, "multiple_faces"],
    [415, "unsupported_image"],
    [413, "too_large"],
  ])("maps %i %s through", async (status, code) => {
    mockFetch(async () => json({ error: code }, status));
    expect(await scoreImage(jpeg)).toEqual({ ok: false, code });
  });

  it("maps a 401 to scorer_unavailable", async () => {
    mockFetch(async () => json({ error: "unauthorized" }, 401));
    expect(await scoreImage(jpeg)).toEqual({ ok: false, code: "scorer_unavailable" });
  });

  it("maps a 502 with HTML to scorer_unavailable", async () => {
    mockFetch(async () => new Response("<html>Bad Gateway</html>", { status: 502 }));
    expect(await scoreImage(jpeg)).toEqual({ ok: false, code: "scorer_unavailable" });
  });

  it("maps a timeout to scorer_unavailable", async () => {
    mockFetch(() => Promise.reject(new DOMException("timed out", "TimeoutError")));
    expect(await scoreImage(jpeg)).toEqual({ ok: false, code: "scorer_unavailable" });
  });

  it("returns scorer_unavailable when the key is missing", async () => {
    vi.stubEnv("SCORER_API_KEY", "");
    const fn = mockFetch(async () => json(payload, 200));
    expect(await scoreImage(jpeg)).toEqual({ ok: false, code: "scorer_unavailable" });
    expect(fn).not.toHaveBeenCalled();
  });
});
