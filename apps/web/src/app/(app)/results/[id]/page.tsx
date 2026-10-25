import Link from "next/link";
import { notFound } from "next/navigation";

import { BreakdownBars } from "@/components/breakdown-bars";
import { DeleteUploadButton } from "@/components/delete-upload-button";
import { FaceOverlay } from "@/components/face-overlay";
import { ScoreCard } from "@/components/score-card";
import { requireSession } from "@/lib/session";
import { getUploadForUser } from "@/lib/uploads";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const row = await getUploadForUser(id, session.user.id);
  if (!row) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
          Back to dashboard
        </Link>
        <DeleteUploadButton id={row.id} />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <FaceOverlay id={row.id} overlay={row.overlay} />
        <div className="space-y-4">
          <ScoreCard score={row.smileScore} date={row.createdAt} />
          <BreakdownBars components={row.components} />
          <p className="text-xs text-muted-foreground">Model {row.modelVersion}</p>
        </div>
      </div>
    </div>
  );
}
