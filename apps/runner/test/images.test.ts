import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { verifyImage } from "../src/images.js";
test("production image digest rejects modified artifacts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "algostep-image-"));
  const file = join(dir, "kernel");
  try {
    await writeFile(file, "known image");
    const digest = createHash("sha256").update("known image").digest("hex");
    await verifyImage(file, digest);
    await writeFile(file, "changed");
    await assert.rejects(verifyImage(file, digest), /MISMATCH/);
    await assert.rejects(verifyImage(file, ""), /REQUIRED/);
  } finally {
    await unlink(file);
    await rmdir(dir);
  }
});
