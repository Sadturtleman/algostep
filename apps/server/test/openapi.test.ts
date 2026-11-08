import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import SwaggerParser from "@apidevtools/swagger-parser";
import { openapi } from "../src/openapi.js";
import { database } from "../src/db.js";
import { seed } from "../src/content.js";
import { createApp } from "../src/app.js";
const require = createRequire(import.meta.url);
const Ajv = require("ajv");

test("Swagger contract validates real MVP responses and keeps API authentication", async () => {
  process.env.NODE_ENV = "test";
  await SwaggerParser.validate(structuredClone(openapi) as any);
  const spec: any = await SwaggerParser.dereference(
    structuredClone(openapi) as any,
  );
  const ajv = new Ajv({ strict: false, validateFormats: false });
  const db = await database();
  await seed(db);
  const origin = "http://localhost:5173";
  const app = await createApp({
    db,
    origin,
    productMode: "mvp",
    googleClientId: "test",
    sessionSecret: "test",
    runnerToken: "test",
    llmEnabled: false,
    verifyGoogle: async () => ({
      sub: "swagger-test",
      email: "swagger@test.invalid",
      name: "Swagger test",
    }),
  });
  let headers: Record<string, string> = { origin };
  async function check(path: string, method: any, url = path, payload?: any) {
    const res = await app.inject({
      method,
      url,
      headers,
      ...(payload ? { payload } : {}),
    });
    assert.equal(res.statusCode, 200, res.body);
    const validate = ajv.compile(
      spec.paths[path][method.toLowerCase()].responses["200"].content[
        "application/json"
      ].schema,
    );
    assert.ok(
      validate(res.json()),
      `${method} ${path}: ${JSON.stringify(validate.errors)}`,
    );
    return res;
  }
  try {
    assert.equal((await app.inject("/docs")).statusCode, 200);
    assert.match((await app.inject("/docs")).body, /SwaggerUIBundle/);
    assert.equal(
      (await app.inject("/docs/assets/swagger-ui-bundle.js")).statusCode,
      200,
    );
    assert.deepEqual((await app.inject("/openapi.json")).json(), openapi);
    assert.equal((await app.inject("/api/records")).statusCode, 401);
    await check("/api/health", "GET");
    await check("/api/config", "GET");
    const login = await check("/api/auth/google", "POST", undefined, {
      credential: "swagger-test-token",
    });
    headers = {
      origin,
      cookie: String(login.headers["set-cookie"]).split(";")[0],
      "x-csrf-token": login.json().csrf,
    };
    await check("/api/me", "GET");
    const topics = (await check("/api/topics", "GET")).json().topics;
    await check("/api/quiz/{topic}", "POST", `/api/quiz/${topics[0].id}`, {
      answer: 0,
      requestKey: "swagger-quiz-01",
    });
    const problems = (await check("/api/problems", "GET")).json().problems;
    let record = (
      await check("/api/records", "POST", undefined, {
        problemId: problems[0].id,
        language: "python",
      })
    ).json();
    await check("/api/records", "GET");
    await check("/api/records/{id}", "GET", `/api/records/${record.id}`);
    record = (
      await check("/api/records/{id}", "PATCH", `/api/records/${record.id}`, {
        language: "python",
        source: record.source,
        revision: record.revision,
      })
    ).json();
    const run = (
      await check(
        "/api/records/{id}/executions",
        "POST",
        `/api/records/${record.id}/executions`,
        { requestKey: "swagger-run-01", revision: record.revision },
      )
    ).json();
    await check("/api/executions/{id}", "GET", `/api/executions/${run.id}`);
    await check("/api/records/{id}", "GET", `/api/records/${record.id}`);
    const forbidden = await app.inject({
      method: "DELETE",
      url: `/api/records/${record.id}`,
      headers: { origin, cookie: headers.cookie },
    });
    assert.equal(forbidden.statusCode, 403);
    await check("/api/records/{id}", "DELETE", `/api/records/${record.id}`);
    await check("/api/auth/logout", "POST");
  } finally {
    await app.close();
    await db.close();
  }
});
