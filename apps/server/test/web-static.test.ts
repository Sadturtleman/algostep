import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerWeb } from "../src/web-static.js";
test("direct page navigation serves the app while missing API and assets remain 404", async () => {
  const root = await mkdtemp(join(tmpdir(), "algostep-web-"));
  const app = Fastify();
  try {
    await writeFile(
      join(root, "index.html"),
      "<!doctype html><title>Algostep</title>",
    );
    await registerWeb(app, root);
    for (const path of [
      "/learn/bfs/concept",
      "/learn/tree/predict/3",
      "/learn/fft/code?record=123",
      "/records/abc",
      "/support/abc",
      "/admin/finance",
    ]) {
      const r = await app.inject({
        url: path,
        headers: { accept: "text/html" },
      });
      assert.equal(r.statusCode, 200, path);
      assert.match(r.body, /<title>Algostep/);
    }
    for (const path of [
      "/api",
      "/api/missing",
      "/missing.js",
      "/learning/missing.gif",
    ])
      assert.equal(
        (await app.inject({ url: path, headers: { accept: "text/html" } }))
          .statusCode,
        404,
        path,
      );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/learn/bfs/concept",
          headers: { accept: "text/html" },
        })
      ).statusCode,
      404,
    );
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
