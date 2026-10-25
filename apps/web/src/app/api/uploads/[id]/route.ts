import { getSession } from "@/lib/session";
import { deleteUploadForUser } from "@/lib/uploads";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const result = await deleteUploadForUser(id, session.user.id);
    // 404, not 403: don't reveal that the ID exists.
    if (result === "not_found") return Response.json({ error: "not_found" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (err) {
    // Log IDs and the error message only: never a blob URL, and no stack goes to the client.
    console.error("upload delete failed", {
      userId: session.user.id,
      uploadId: id,
      message: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "delete_failed" }, { status: 500 });
  }
}
