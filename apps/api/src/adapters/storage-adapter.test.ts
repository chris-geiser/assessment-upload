import { rm } from "node:fs/promises";
import { afterAll, describe, expect, it } from "vitest";
import { LocalFsStorage, uploadKey } from "./storage-adapter.js";

const dir = ".test-storage-unit";
const storage = new LocalFsStorage(dir);

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("LocalFsStorage", () => {
  it("builds S3-style keys uploads/{id}/original.{ext}", () => {
    expect(uploadKey("abc", "csv")).toBe("uploads/abc/original.csv");
    expect(uploadKey("abc", ".XLSX")).toBe("uploads/abc/original.xlsx");
  });

  it("round-trips a stored file unmodified (P3)", async () => {
    const key = uploadKey("11111111-1111-1111-1111-111111111111", "csv");
    const data = Buffer.from("student_id,LNF\n1001,40\n", "utf8");
    await storage.put(key, data);
    const got = await storage.get(key);
    expect(got.equals(data)).toBe(true);
  });

  it("rejects keys that escape the storage root", async () => {
    await expect(storage.get("../../etc/passwd")).rejects.toThrow(/Invalid storage key/);
  });
});
