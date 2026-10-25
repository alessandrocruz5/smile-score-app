import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

// Secret and base URL come from BETTER_AUTH_SECRET and BETTER_AUTH_URL. Sessions are DB-backed.
// Rate limiting is left at Better Auth's built-in defaults.
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  plugins: [nextCookies()], // must be last; lets Server Actions set cookies
});
