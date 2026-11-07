import { practiceTopic } from "../src/focused-concepts.js";
import test from "node:test";
import assert from "node:assert/strict";
import { database } from "../src/db.js";
import { seed } from "../src/content.js";
import { catalog } from "../src/content-admin.js";
test("all 200 concepts link to complete coding problems and reseeding preserves published content", async () => {
  const db = await database();
  try {
    await seed(db);
    const topics = (await db.query("SELECT * FROM topics")).rows;
    const problems = (await db.query("SELECT * FROM problems")).rows;
    assert.equal(topics.length, 200);
    assert.equal(problems.length, 47);
    catalog.parse({ topics, problems });
    assert.deepEqual(
      new Set(problems.map((p) => p.topic_id)),
      new Set(topics.map((t) => practiceTopic(t.id))),
    );
    for (const p of problems) {
      assert.deepEqual(Object.keys(p.references_code).sort(), [
        "cpp",
        "java",
        "python",
      ]);
      assert.ok(p.tests.length >= 2, p.id);
      for (const t of p.tests) {
        assert.ok(t.expected.endsWith("\n"), p.id);
        assert.ok(!t.expected.includes("\r"), p.id);
      }
    }
    await db.query(
      "UPDATE problems SET title='Published title' WHERE id='fft-v1'",
    );
    await seed(db);
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM problems")).rows[0].n,
      47,
    );
    assert.equal(
      (await db.query("SELECT title FROM problems WHERE id='fft-v1'")).rows[0]
        .title,
      "Published title",
    );
  } finally {
    await db.close();
  }
});
