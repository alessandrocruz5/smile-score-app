import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { Storage } from "./index";

// Local-dev disk adapter. Named createLocalDiskStorage (not localStorage) so it never shadows the DOM global.
export function createLocalDiskStorage(root: string): Storage {
  const base = path.resolve(root);

  // Path-traversal guard: the resolved path must stay inside the root.
  function resolveSafe(pathname: string): string {
    const full = path.resolve(base, pathname);
    if (!full.startsWith(base + path.sep)) throw new Error(`invalid storage path: ${pathname}`);
    return full;
  }

  return {
    async put(pathname, data) {
      const full = resolveSafe(pathname);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, data);
    },

    async get(pathname) {
      const full = resolveSafe(pathname);
      try {
        await fs.access(full);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
      return Readable.toWeb(createReadStream(full)) as ReadableStream;
    },

    async del(pathname) {
      await fs.rm(resolveSafe(pathname), { force: true });
    },
  };
}

export const localDiskStorage = createLocalDiskStorage(path.join(process.cwd(), ".data"));
