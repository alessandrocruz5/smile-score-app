import { timingSafeEqual } from "node:crypto";
import { PHOTO_RETENTION_DAYS } from "@/lib/validation";

/** True when the Authorization header is `Bearer <secret>`. Fails closed when no secret is configured. */
export function isCronAuthorized(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret || !authHeader) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authHeader);
  // timingSafeEqual throws on unequal lengths, so compare lengths first.
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

/** Uploads created strictly before this instant are expired. */
export function retentionCutoff(now: Date, days = PHOTO_RETENTION_DAYS): Date {
  return new Date(now.getTime() - days * 86_400_000);
}
