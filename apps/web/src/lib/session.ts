import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Every server component, route handler and server action that touches user data checks the session
// itself (proxy.ts is UX only, see CVE-2025-29927).
// cache(): the layout and the page both check the session; this makes it one DB lookup per request.
export const getSession = cache(async () => {
  // route handlers: null -> they return 401
  return auth.api.getSession({ headers: await headers() });
});

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

// pages + server actions: redirect if none
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
