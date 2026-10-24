import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok" });
  } catch (error) {
    console.error("health check failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ status: "error" }, { status: 503 });
  }
}
