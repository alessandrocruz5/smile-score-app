import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProfileForm } from "@/components/profile-form";
import { requireSession } from "@/lib/session";

export default async function ProfilePage() {
  const session = await requireSession();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <Card className="max-w-sm">
        <CardHeader>
          <CardTitle>Your details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={session.user.email} readOnly disabled />
          </div>
          <ProfileForm defaultName={session.user.name} />
        </CardContent>
      </Card>
    </div>
  );
}
