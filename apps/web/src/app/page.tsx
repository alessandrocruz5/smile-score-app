import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";

// cacheComponents: the redirect depends on the request's cookies, so this route blocks instead of
// prerendering a static shell. That lets redirect() return a real 307 rather than a streamed one.
export const instant = false;

export default async function Home() {
  const session = await getSession();
  redirect(session ? "/dashboard" : "/login");
}
