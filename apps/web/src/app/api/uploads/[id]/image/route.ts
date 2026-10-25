import { getSession } from "@/lib/session";
import { getStorage } from "@/lib/storage";
import { getUploadForUser } from "@/lib/uploads";

// The blob store is private: images are only served through this owner-checked route.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const row = await getUploadForUser(id, session.user.id);
  // 404, not 403: don't reveal that the ID exists.
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });

  const stream = await getStorage().get(row.blobPathname);
  if (!stream) return Response.json({ error: "not_found" }, { status: 404 });

  return new Response(stream, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
