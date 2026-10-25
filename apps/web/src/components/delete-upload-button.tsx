"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { uploadErrorMessages } from "@/lib/validation";

const DELETE_FAILED_MESSAGE = "Couldn't delete this photo. Please try again.";

export function DeleteUploadButton({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (!window.confirm("Delete this photo? This can't be undone.")) return;
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/uploads/${id}`, { method: "DELETE" });
      if (res.status === 204) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      setError(res.status === 401 ? uploadErrorMessages.unauthorized : DELETE_FAILED_MESSAGE);
    } catch {
      setError(DELETE_FAILED_MESSAGE);
    }
    setDeleting(false);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button type="button" variant="destructive" onClick={onClick} disabled={deleting}>
        {deleting ? "Deleting…" : "Delete photo"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
