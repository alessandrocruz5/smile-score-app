import { BlobNotFoundError, del, get, put } from "@vercel/blob";
import type { Storage } from "./index";

// Private Vercel Blob store. Blob URLs are never returned or logged: reads go through get(pathname)
// and are streamed back by our own route handlers after an owner check.
export const blobStorage: Storage = {
  async put(pathname, data, contentType) {
    await put(pathname, data, {
      access: "private",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true, // re-putting a pathname must not throw
    });
  },

  async get(pathname) {
    try {
      const result = await get(pathname, { access: "private" });
      if (!result || result.statusCode !== 200) return null;
      return result.stream;
    } catch (err) {
      if (err instanceof BlobNotFoundError) return null;
      throw err;
    }
  },

  async del(pathname) {
    await del(pathname);
  },
};
