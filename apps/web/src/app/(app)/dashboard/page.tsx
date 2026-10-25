import { HistoryGrid } from "@/components/history-grid";
import { UploadForm } from "@/components/upload-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/session";
import { listUploadsForUser } from "@/lib/uploads";

export default async function DashboardPage() {
  const session = await requireSession();
  const items = await listUploadsForUser(session.user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Your smiles</h1>
      <Card>
        <CardHeader>
          <CardTitle>Score a new smile</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadForm />
        </CardContent>
      </Card>
      <HistoryGrid items={items} />
    </div>
  );
}
