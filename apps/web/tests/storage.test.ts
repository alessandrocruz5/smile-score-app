import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLocalDiskStorage } from "@/lib/storage/local";

async function readAll(stream: ReadableStream): Promise<Buffer> {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

describe("local disk storage", () => {
  let root: string;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "storage-test-"));
  });
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("puts, gets, deletes, then returns null", async () => {
    const storage = createLocalDiskStorage(root);
    const bytes = Buffer.from([1, 2, 3, 4, 255]);
    await storage.put("uploads/user/a.jpg", bytes, "image/jpeg");

    const stream = await storage.get("uploads/user/a.jpg");
    expect(stream).not.toBeNull();
    expect((await readAll(stream!)).equals(bytes)).toBe(true);

    await storage.del("uploads/user/a.jpg");
    expect(await storage.get("uploads/user/a.jpg")).toBeNull();
  });

  it("del of a missing file does not throw", async () => {
    await expect(createLocalDiskStorage(root).del("nope.jpg")).resolves.toBeUndefined();
  });

  it("rejects path traversal", async () => {
    const storage = createLocalDiskStorage(root);
    await expect(storage.put("../escape.jpg", Buffer.from("x"), "image/jpeg")).rejects.toThrow();
    await expect(storage.get("../escape.jpg")).rejects.toThrow();
    await expect(storage.del("../escape.jpg")).rejects.toThrow();
  });
});
