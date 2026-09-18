import { test } from "node:test";
import assert from "node:assert/strict";
import { validateJob } from "../src/protocol.js";
import { runIsolated } from "../src/firecracker.js";
test("runner rejects malformed IDs and resource policies", () => {
  assert.throws(() => validateJob({ id: "../../etc" }));
  assert.throws(() =>
    validateJob({
      id: "12345678-1234-1234-1234-123456789012",
      language: "python",
      source: "",
      tests: [],
      limits: { testMs: Infinity },
    }),
  );
});
test("runner never falls back to executing code on unsupported hosts", async () => {
  if (process.platform !== "linux")
    await assert.rejects(runIsolated({} as any), /KVM_LINUX_REQUIRED/);
});
