import { GoogleAuth } from "google-auth-library";
import { gzipSync, gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import type { DB } from "./db.js";
export interface ObjectStorage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
export class GcsStorage implements ObjectStorage {
  private auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/devstorage.read_write"],
  });
  constructor(private bucket: string) {
    if (!/^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(bucket))
      throw new Error("Invalid bucket");
  }
  private url(key: string) {
    if (!/^traces\/[a-f0-9-]{36}\.json\.gz$/.test(key))
      throw new Error("Invalid object key");
    return `https://storage.googleapis.com/storage/v1/b/${this.bucket}/o/${encodeURIComponent(key)}`;
  }
  async put(key: string, data: Buffer) {
    this.url(key);
    try {
      await this.auth.request({
        url: `https://storage.googleapis.com/upload/storage/v1/b/${this.bucket}/o?uploadType=media&ifGenerationMatch=0&name=${encodeURIComponent(key)}`,
        method: "POST",
        headers: { "Content-Type": "application/gzip" },
        data,
        timeout: 15000,
      });
    } catch (e: any) {
      if (e.response?.status !== 412 || !(await this.get(key)).equals(data))
        throw e;
    }
  }
  async get(key: string) {
    const r = await this.auth.request<ArrayBuffer>({
      url: this.url(key) + "?alt=media",
      responseType: "arraybuffer",
      timeout: 15000,
    });
    const data = Buffer.from(r.data);
    if (data.length > 2 * 1024 * 1024) throw new Error("Object exceeds limit");
    return data;
  }
  async delete(key: string) {
    try {
      await this.auth.request({
        url: this.url(key),
        method: "DELETE",
        timeout: 15000,
      });
    } catch (e: any) {
      if (e.response?.status !== 404) throw e;
    }
  }
}
export async function externalize(
  storage: ObjectStorage,
  executionId: string,
  result: any,
) {
  const traces = (result.tests ?? []).map((t: any) => ({
    trace: t.trace ?? [],
    traceTruncated: t.traceTruncated ?? false,
  }));
  const data = gzipSync(Buffer.from(JSON.stringify(traces))),
    key = `traces/${executionId}.json.gz`;
  await storage.put(key, data);
  return {
    ...result,
    traceObject: {
      key,
      sha256: createHash("sha256").update(data).digest("hex"),
    },
    tests: result.tests.map((t: any) => ({ ...t, trace: undefined })),
  };
}
export async function hydrate(
  storage: ObjectStorage | undefined,
  execution: any,
) {
  const ref = execution?.result?.traceObject;
  if (!ref) return execution;
  if (!storage) throw new Error("Trace storage not configured");
  const data = await storage.get(ref.key);
  if (createHash("sha256").update(data).digest("hex") !== ref.sha256)
    throw new Error("Trace checksum mismatch");
  const traces = JSON.parse(
    gunzipSync(data, { maxOutputLength: 2 * 1024 * 1024 }).toString(),
  );
  return {
    ...execution,
    result: {
      ...execution.result,
      tests: execution.result.tests.map((t: any, i: number) => ({
        ...t,
        ...traces[i],
      })),
    },
  };
}
export async function deleteObjects(
  db: DB,
  storage: ObjectStorage | undefined,
) {
  if (!storage) return;
  for (const row of (
    await db.query(
      "SELECT object_key FROM object_deletions ORDER BY created_at LIMIT 25",
    )
  ).rows) {
    await storage.delete(row.object_key);
    await db.query("DELETE FROM object_deletions WHERE object_key=$1", [
      row.object_key,
    ]);
  }
}
