import { blobStorage } from "./blob";
import { localDiskStorage } from "./local";

export interface Storage {
  put(pathname: string, data: Buffer, contentType: string): Promise<void>;
  get(pathname: string): Promise<ReadableStream | null>; // null when missing
  del(pathname: string): Promise<void>;
}

let storage: Storage | undefined;

// The adapter is chosen on the first call, never at import time: Vercel sets VERCEL during `next build`
// too, and the build loads route modules, so an import-time throw would fail the build instead of the
// first request.
export function getStorage(): Storage {
  if (storage) return storage;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    storage = blobStorage;
  } else if (process.env.VERCEL) {
    // Vercel's disk doesn't persist, so the local adapter would silently lose uploads.
    throw new Error("BLOB_READ_WRITE_TOKEN is required on Vercel");
  } else {
    storage = localDiskStorage;
  }
  return storage;
}
