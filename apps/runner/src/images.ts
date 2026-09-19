import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
export async function verifyImage(path: string, expected: string) {
  if (!/^[a-f0-9]{64}$/.test(expected))
    throw new Error("IMAGE_DIGEST_REQUIRED");
  const hash = createHash("sha256");
  for await (const part of createReadStream(path)) hash.update(part);
  if (hash.digest("hex") !== expected) throw new Error("IMAGE_DIGEST_MISMATCH");
}
export async function verifyProductionImages() {
  if (process.env.NODE_ENV !== "production") return;
  if (!process.env.API_URL?.startsWith("https://"))
    throw new Error("PRODUCTION_RUNNER_REQUIRES_HTTPS");
  for (const name of ["KERNEL", "ROOTFS"]) {
    const path = process.env[name + "_PATH"];
    if (!path) throw new Error("IMAGE_PATH_REQUIRED");
    await verifyImage(path, process.env[name + "_SHA256"] ?? "");
  }
}
