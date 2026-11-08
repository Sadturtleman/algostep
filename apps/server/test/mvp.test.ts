import { test } from "node:test";
import assert from "node:assert/strict";
import { database } from "../src/db.js";
import { seed } from "../src/content.js";
import { createApp } from "../src/app.js";
import { maintenance } from "../src/maintenance.js";
import { mvpTopics, productMode } from "../src/product.js";

test("MVP contract: core flow, ownership, excluded features and background isolation", async () => {
  process.env.NODE_ENV = "test";
  assert.equal(productMode(undefined), "mvp");
  assert.throws(() => productMode("typo"));
  const db = await database();
  await seed(db);
  const origin = "http://localhost:5173";
  const app = await createApp({
    productMode: "mvp",
    db,
    origin,
    googleClientId: "test",
    sessionSecret: "test",
    runnerToken: "runner",
    llmEnabled: true,
    adminEmails: ["owner@test.invalid"],
    verifyGoogle: async (sub) => ({
      sub,
      email: `${sub}@test.invalid`,
      name: sub,
    }),
  });
  try {
    const config = (await app.inject("/api/config")).json();
    assert.equal(config.productMode, "mvp");
    assert.equal(config.reviewEnabled, false);
    assert.equal(config.ga4MeasurementId, null);
    assert.equal(config.features.admin, false);
    assert.equal(config.limits.memoryBytes, 512 * 1024 * 1024);
    assert.equal((await app.inject("/api/topics")).statusCode, 401);
    const auth = await app.inject({
      method: "POST",
      url: "/api/auth/google",
      headers: { origin },
      payload: { credential: "owner-identity" },
    });
    assert.equal(auth.statusCode, 200, auth.body);
    assert.equal(auth.json().user.isAdmin, false);
    const headers = {
      origin,
      cookie: String(auth.headers["set-cookie"]).split(";")[0],
      "x-csrf-token": auth.json().csrf,
    };
    const call = (method: any, url: string, payload?: any) =>
      app.inject({ method, url, headers, payload });
    const topics = (await call("GET", "/api/topics")).json().topics;
    assert.deepEqual(
      topics.map((t: any) => t.id).sort(),
      [...mvpTopics].sort(),
    );
    const problems = (await call("GET", "/api/problems")).json().problems;
    assert.equal(problems.length, 8);
    assert.equal(
      (
        await call("POST", "/api/records", {
          problemId: "fft-v1",
          language: "python",
        })
      ).statusCode,
      404,
    );
    const created = await call("POST", "/api/records", {
      problemId: "binary-search-v1",
      language: "python",
    });
    assert.equal(created.statusCode, 200, created.body);
    const id = created.json().id;
    for (const [method, url] of [
      ["GET", "/api/admin/dashboard"],
      ["GET", "/api/support"],
      ["POST", "/api/analytics/visit"],
      ["GET", "/api/review-usage"],
      ["POST", `/api/records/${id}/reviews`],
      ["GET", `/api/records/${id}/pdf`],
      ["POST", "/api/operations/costs/import"],
      ["POST", "/api/auth/challenge"],
    ])
      assert.equal(
        (await call(method, url, method === "POST" ? {} : undefined))
          .statusCode,
        404,
        url,
      );
    const mobile = await app.inject({
      method: "POST",
      url: "/api/auth/google",
      headers: { origin },
      payload: { credential: "android-identity", client: "android" },
    });
    assert.equal(mobile.statusCode, 403);
    const problem = problems.find((p: any) => p.id === "binary-search-v1");
    const saved = await call("PATCH", `/api/records/${id}`, {
      source: problem.references_code.python,
      language: "python",
      revision: 0,
    });
    assert.equal(saved.statusCode, 200, saved.body);
    assert.equal(
      (
        await call("PATCH", `/api/records/${id}`, {
          source: "x",
          language: "python",
          revision: 0,
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await call("PATCH", `/api/records/${id}`, {
          source: "가".repeat(23000),
          language: "python",
          revision: 1,
        })
      ).statusCode,
      400,
    );
    const payload = {
      requestKey: "mvp-execution-1",
      revision: saved.json().revision,
      mode: "judge",
    };
    const execution = await call(
      "POST",
      `/api/records/${id}/executions`,
      payload,
    );
    assert.equal(execution.statusCode, 200, execution.body);
    assert.equal(
      (await call("POST", `/api/records/${id}/executions`, payload)).json().id,
      execution.json().id,
    );
    const job = (
      await app.inject({
        method: "POST",
        url: "/api/internal/claim",
        headers: { authorization: "Bearer runner" },
        payload: {},
      })
    ).json().job;
    assert.equal(job.id, execution.json().id);
    assert.equal(job.limits.testMs, 10000);
    assert.ok(job.tests.length > 0);
    const result = {
      verdict: "AC",
      tests: [
        {
          input: "1\n21\n21\n",
          expected: "0\n",
          actual: "0\n",
          stderr: "",
          verdict: "AC",
          elapsedMs: 1,
          peakMemoryBytes: 1024,
          trace: [{ line: 1, event: "line", locals: { a: [21] }, stack: [] }],
          traceTruncated: false,
        },
      ],
      traceSupport: "PYTHON",
      runnerImage: "fixture",
    };
    const done = await app.inject({
      method: "POST",
      url: `/api/internal/executions/${job.id}/result`,
      headers: { authorization: "Bearer runner" },
      payload: { token: job.token, result },
    });
    assert.equal(done.statusCode, 200, done.body);
    const read = (await call("GET", `/api/executions/${job.id}`)).json();
    assert.equal(read.status, "SUCCEEDED");
    assert.equal(read.result.tests[0].trace[0].locals.a[0], 21);
    assert.deepEqual(
      (await call("GET", `/api/records/${id}`)).json().reviews,
      [],
    );
    const other = await app.inject({
      method: "POST",
      url: "/api/auth/google",
      headers: { origin },
      payload: { credential: "another-identity" },
    });
    assert.equal(
      (
        await app.inject({
          url: `/api/executions/${job.id}`,
          headers: {
            cookie: String(other.headers["set-cookie"]).split(";")[0],
          },
        })
      ).statusCode,
      404,
    );
    await call("POST", `/api/records/${id}/executions`, {
      ...payload,
      requestKey: "mvp-execution-2",
    });
    const interrupted = (
      await app.inject({
        method: "POST",
        url: "/api/internal/claim",
        headers: { authorization: "Bearer runner" },
        payload: {},
      })
    ).json().job;
    await db.query(
      "UPDATE executions SET lease_expires_at=now()-interval '1 second' WHERE id=$1",
      [interrupted.id],
    );
    // Invalid provider settings must not be parsed or called in the MVP worker.
    process.env.LLM_PROVIDER = "disabled-test";
    await maintenance(db, undefined, "mvp");
    assert.equal(
      (await call("GET", `/api/executions/${interrupted.id}`)).json().status,
      "FAILED",
    );
    await call("DELETE", `/api/records/${id}`);
    for (const table of [
      "business_events",
      "visitor_days",
      "analytics_deliveries",
      "amplitude_deliveries",
      "reviews",
    ])
      assert.equal(
        Number(
          (await db.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n,
        ),
        0,
        table,
      );
  } finally {
    delete process.env.LLM_PROVIDER;
    await app.close();
    await db.close();
  }
});
