import { describe, expect, it } from "vitest";
import { isCronAuthorized, retentionCutoff } from "@/lib/cron";
import { PHOTO_RETENTION_DAYS } from "@/lib/validation";

describe("isCronAuthorized", () => {
  const secret = "s3cret-value";

  it("accepts the right bearer", () => {
    expect(isCronAuthorized(`Bearer ${secret}`, secret)).toBe(true);
  });

  it("rejects a wrong bearer, a missing prefix, a different length and null", () => {
    expect(isCronAuthorized("Bearer s3cret-valuX", secret)).toBe(false);
    expect(isCronAuthorized(secret, secret)).toBe(false);
    expect(isCronAuthorized(`Bearer ${secret}extra`, secret)).toBe(false);
    expect(isCronAuthorized(null, secret)).toBe(false);
  });

  it("fails closed when the secret is undefined or empty", () => {
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
    expect(isCronAuthorized("Bearer undefined", undefined)).toBe(false);
    expect(isCronAuthorized(null, undefined)).toBe(false);
    expect(isCronAuthorized("", "")).toBe(false);
  });
});

describe("retentionCutoff", () => {
  const now = new Date("2026-11-30T00:00:00Z");

  it("subtracts the given number of days", () => {
    expect(retentionCutoff(now, 30).toISOString()).toBe("2026-10-31T00:00:00.000Z");
  });

  it("defaults to PHOTO_RETENTION_DAYS", () => {
    expect(retentionCutoff(now).getTime()).toBe(retentionCutoff(now, PHOTO_RETENTION_DAYS).getTime());
  });

  it("is earlier than now, so new photos are never expired", () => {
    expect(retentionCutoff(now).getTime()).toBeLessThan(now.getTime());
  });
});
