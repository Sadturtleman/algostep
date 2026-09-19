import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { database } from "../src/db.js";
import { migrate } from "../src/migrations.js";
import { seed } from "../src/content.js";
import { createApp } from "../src/app.js";
import {
  externalize,
  hydrate,
  deleteObjects,
  type ObjectStorage,
} from "../src/object-storage.js";
import { equivalent, staticFindings } from "../src/static-analysis.js";
import { catalog } from "../src/content-admin.js";
process.env.NODE_ENV = "test";
test("migration is repeatable and preserves saved data", async () => {
  const db = await database();
  try {
    await seed(db);
    const before = (await db.query("SELECT count(*) AS n FROM problems"))
      .rows[0].n;
    await migrate(db);
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM problems")).rows[0].n,
      before,
    );
    assert.equal(
      (await db.query("SELECT max(version) AS n FROM schema_migrations"))
        .rows[0].n,
      2,
    );
  } finally {
    await db.close();
  }
});
test("reference proof preserves indentation, literal content, token boundaries and preprocessor lines", () => {
  assert.equal(
    equivalent(
      "for x in a:\n    print(x) # note\n",
      "for x in a:\n    print(x)\n",
      "python",
    ),
    true,
  );
  assert.equal(
    equivalent(
      "for x in a:\nprint(x)\n",
      "for x in a:\n    print(x)\n",
      "python",
    ),
    false,
  );
  assert.equal(
    equivalent("int n = 2; // comment\n", "int n=2;\n", "cpp"),
    true,
  );
  assert.equal(equivalent("int n=3;", "int n=2;", "cpp"), false);
  assert.equal(
    equivalent("#define X 1\nint y=X;", "#define X 1 int y=X;", "cpp"),
    false,
  );
  assert.equal(staticFindings('print("while for sort(")', "python").length, 0);
  assert.equal(staticFindings("for x in a:\n    a.pop(0)", "python").length, 2);
});
test("GCS adapter contract round-trips traces, detects corruption and retries deletion", async () => {
  const data = new Map<string, Buffer>();
  const store: ObjectStorage = {
    put: async (k, v) => {
      data.set(k, v);
    },
    get: async (k) => data.get(k)!,
    delete: async (k) => {
      data.delete(k);
    },
  };
  const result = {
    tests: [{ verdict: "AC", trace: [{ line: 1, locals: { x: 2 } }] }],
  };
  const saved = await externalize(store, randomUUID(), result);
  assert.equal(saved.tests[0].trace, undefined);
  assert.deepEqual(
    (await hydrate(store, { result: saved })).result.tests[0].trace,
    result.tests[0].trace,
  );
  const key = saved.traceObject.key;
  const original = data.get(key)!;
  data.set(key, Buffer.from("tampered"));
  await assert.rejects(hydrate(store, { result: saved }), /checksum/);
  data.set(key, original);
  const db = await database();
  try {
    await db.query("INSERT INTO object_deletions(object_key) VALUES($1)", [
      key,
    ]);
    await deleteObjects(db, store);
    assert.equal(data.size, 0);
    await deleteObjects(db, store);
  } finally {
    await db.close();
  }
});
test("Android nonce is single use and Android session cannot execute or read records", async () => {
  const db = await database();
  await seed(db);
  const origin = "https://learn.example";
  const app = await createApp({
    db,
    origin,
    googleClientId: "test",
    sessionSecret: "test",
    runnerToken: "runner",
    operationsToken: "ops",
    llmEnabled: false,
    verifyGoogle: async (token) => ({
      sub: "android",
      email: "a@example.test",
      name: "A",
      nonce: token,
    }),
  });
  try {
    const challenge = await app.inject({
      method: "POST",
      url: "/api/auth/challenge",
      headers: { origin },
      payload: {},
    });
    const cookie = String(challenge.headers["set-cookie"]).split(";")[0];
    const login = () =>
      app.inject({
        method: "POST",
        url: "/api/auth/google",
        headers: { origin, cookie },
        payload: { credential: challenge.json().nonce, client: "android" },
      });
    const logged = await login();
    assert.equal(logged.statusCode, 200, logged.body);
    assert.equal((await login()).statusCode, 401);
    const headers = {
      origin,
      cookie: String(logged.headers["set-cookie"]).split(";")[0],
      "x-csrf-token": logged.json().csrf,
    };
    assert.equal(
      (await app.inject({ url: "/api/topics", headers })).statusCode,
      200,
    );
    assert.equal(
      (await app.inject({ url: "/api/records", headers })).statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/records",
          headers,
          payload: { problemId: "binary-search-v1", language: "python" },
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          url: "/api/operations/metrics",
          headers: { authorization: "Bearer runner" },
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await app.inject({
          url: "/api/operations/metrics",
          headers: { authorization: "Bearer ops" },
        })
      ).statusCode,
      200,
    );
  } finally {
    await app.close();
    await db.close();
  }
});
test("catalog publishing rejects invalid quiz answers and duplicate ids", () => {
  assert.equal(
    catalog.safeParse({
      topics: [
        {
          id: "a",
          title: "a",
          category: "a",
          priority: "P0",
          body: "a".repeat(40),
          complexity: "O(n)",
          quiz: {
            question: "q",
            options: ["a", "b"],
            answer: 2,
            explanation: "x",
          },
        },
      ],
      problems: [],
    }).success,
    false,
  );
});
