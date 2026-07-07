import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { loadConfig } from "../config.js";

// P2/P5: S3-compatible key semantics (uploads/{upload_id}/original.{ext}). MVP writes
// to a local directory; the production S3 adapter is a bounded swap of this one file.
export interface StorageAdapter {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export function uploadKey(uploadId: string, ext: string): string {
  const clean = ext.replace(/^\./, "").toLowerCase() || "dat";
  return `uploads/${uploadId}/original.${clean}`;
}

export class LocalFsStorage implements StorageAdapter {
  private readonly baseDir: string;

  constructor(baseDir: string = loadConfig().storageDir) {
    this.baseDir = resolve(baseDir);
  }

  private pathFor(key: string): string {
    // Prevent path traversal outside the storage root.
    const full = resolve(this.baseDir, key);
    if (!full.startsWith(this.baseDir)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const full = this.pathFor(key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, data);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    // Present for S3 signature parity; app flows never destructively delete (P3).
    await rm(this.pathFor(key), { force: true });
  }

  get root(): string {
    return this.baseDir;
  }

  storagePath(key: string): string {
    return join(this.baseDir, key);
  }
}
