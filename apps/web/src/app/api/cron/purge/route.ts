import { isCronAuthorized, retentionCutoff } from "@/lib/cron";
import { purgeExpiredUploads } from "@/lib/uploads";

// Called daily by Vercel Cron (vercel.json), which sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: Request) {
  if (!isCronAuthorized(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(await purgeExpiredUploads(retentionCutoff(new Date())), { status: 200 });
}
