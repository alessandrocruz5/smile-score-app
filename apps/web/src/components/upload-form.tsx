"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DecodeError, downscaleToJpeg } from "@/lib/downscale";
import {
  MAX_RAW_FILE_BYTES,
  PHOTO_RETENTION_DAYS,
  uploadErrorCodes,
  uploadErrorMessages,
  type UploadErrorCode,
} from "@/lib/validation";

function isUploadErrorCode(value: unknown): value is UploadErrorCode {
  return uploadErrorCodes.some((code) => code === value);
}

export function UploadForm() {
  const router = useRouter();
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<UploadErrorCode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const urlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef(0); // ignores a slow downscale that a newer pick has superseded

  function replacePreview(blob: Blob | null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = blob ? URL.createObjectURL(blob) : null;
    setPreviewUrl(urlRef.current);
  }

  useLayoutEffect(() => {
    const input = fileInputRef.current;
    // cacheComponents keeps this route alive in <Activity>; hiding it runs this cleanup, so we come back to a fresh form.
    return () => {
      selectionRef.current += 1;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
      setPreviewUrl(null);
      setPhoto(null);
      setConsent(false);
      setError(null);
      setSubmitting(false);
      if (input) input.value = "";
    };
  }, []);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const selection = ++selectionRef.current;
    setError(null);
    setPhoto(null);
    replacePreview(null);
    if (!file) return;
    if (file.size > MAX_RAW_FILE_BYTES) {
      setError("too_large");
      return;
    }
    try {
      const blob = await downscaleToJpeg(file);
      if (selection !== selectionRef.current) return;
      setPhoto(blob);
      replacePreview(blob);
    } catch (err) {
      if (selection !== selectionRef.current) return;
      setError(err instanceof DecodeError ? "unsupported_image" : "upload_failed");
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photo || !consent) return;
    setError(null);
    setSubmitting(true);
    const body = new FormData();
    body.set("image", photo, "photo.jpg");
    body.set("consent", "true");
    try {
      const response = await fetch("/api/uploads", { method: "POST", body });
      if (response.status === 201) {
        const { id } = (await response.json()) as { id: string };
        router.push(`/results/${id}`);
        return; // keep the loading state while the route changes
      }
      let code: UploadErrorCode = response.status === 401 ? "unauthorized" : "upload_failed";
      try {
        const data: unknown = await response.json();
        const apiError = (data as { error?: unknown } | null)?.error;
        if (isUploadErrorCode(apiError)) code = apiError;
      } catch {
        // Non-JSON body: a 413 here is the host's own body limit, not ours.
        if (response.status === 413) code = "too_large";
      }
      setError(code);
    } catch {
      setError("upload_failed");
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="photo">Choose a photo</Label>
        <input
          id="photo"
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={submitting}
          onChange={onFileChange}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
      </div>
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- local blob: URL, nothing for next/image to optimise
        <img
          src={previewUrl}
          alt="Preview of your selected photo"
          className="max-h-64 rounded-lg object-contain"
        />
      )}
      <div className="flex items-start gap-2">
        <input
          id="consent"
          type="checkbox"
          required
          checked={consent}
          disabled={submitting}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1 size-4"
        />
        <label htmlFor="consent" className="text-sm">
          I agree that my photo and its face measurements are stored privately and used only to
          compute my smile score. They&apos;re deleted automatically after {PHOTO_RETENTION_DAYS}{" "}
          days, and I can delete them sooner.
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {uploadErrorMessages[error]}
        </p>
      )}
      <Button type="submit" disabled={submitting || !photo || !consent}>
        {submitting ? "Scoring…" : "Score my smile"}
      </Button>
    </form>
  );
}
