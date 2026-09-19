import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { database, type DB } from "../src/db.js";
import { createApp } from "../src/app.js";
import { seed } from "../src/content.js";
import { businessEvent, visit } from "../src/business.js";
import {
  analyticsContext,
  readAnalyticsContext,
} from "../src/analytics-context.js";
import { ga4Payload, deliverGa4, ga4Config } from "../src/ga4.js";
import { eventProperties, ga4EventName } from "../src/event-catalog.js";
process.env.NODE_ENV = "test";
let db: DB,
  app: Awaited<ReturnType<typeof createApp>>,
  actor: string,
  cookie: string,
  csrf: string,
  analyticsId: string;
const origin = "http://localhost:5173";
const config = { measurementId: "G-TEST12345", apiSecret: "test-only" };
before(async () => {
  db = await database();
  await seed(db);
  app = await createApp({
    db,
    origin,
    googleClientId: "test",
    sessionSecret: "test",
    runnerToken: "test",
    llmEnabled: false,
    adminEmails: ["admin@example.test"],
    verifyGoogle: async () => ({
      sub: "analytics-admin",
      name: "Admin",
      email: "admin@example.test",
    }),
  });
  const r = await app.inject({
    method: "POST",
    url: "/api/auth/google",
    headers: { origin },
    payload: { credential: "analytics-test-token" },
  });
  assert.equal(r.statusCode, 200, r.body);
  cookie = String(r.headers["set-cookie"]).split(";")[0];
  csrf = r.json().csrf;
  actor = r.json().user.id;
  analyticsId = r.json().user.analyticsId;
});
after(async () => {
  await app.close();
  await db.close();
});
const reset = () => db.query("DELETE FROM business_events");
const add = (key: string = randomUUID()) =>
  businessEvent(db, "LOGOUT", actor, null, key);
const statuses = async () =>
  (
    await db.query(
      "SELECT status,last_code,attempts FROM analytics_deliveries ORDER BY event_id",
    )
  ).rows;
const post = (events: any[], headers: Record<string, string> = {}) =>
  app.inject({
    method: "POST",
    url: "/api/analytics/events",
    headers: { origin, cookie, "x-csrf-token": csrf, ...headers },
    payload: { events },
  });
const okFetch: typeof fetch = async (url, options) =>
  new Response(
    String(url).includes("/debug/")
      ? JSON.stringify({ validationMessages: [] })
      : null,
    { status: String(url).includes("/debug/") ? 200 : 204 },
  );

test("transactional outbox deduplicates, rolls back, and daily visits are one event per KST day", async () => {
  await reset();
  await add("same");
  await add("same");
  assert.equal((await statuses()).length, 1);
  await assert.rejects(
    db.tx(async (tx) => {
      await businessEvent(tx, "LOGOUT", actor, null, "rollback");
      throw Error("rollback");
    }),
  );
  assert.equal((await statuses()).length, 1);
  await db.query("DELETE FROM visitor_days");
  await visit(db, actor);
  await visit(db, actor);
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM business_events WHERE type='DAILY_VISIT'",
      )
    ).rows[0].n,
    1,
  );
});
test("client API rejects server-event spoofing, content fields, unknown topics and missing CSRF; duplicate retries do not double count", async () => {
  await reset();
  const e = {
    requestKey: randomUUID(),
    type: "SCREEN_VIEWED",
    properties: { screen: "home" },
  };
  assert.equal((await post([e], { "x-csrf-token": "" })).statusCode, 403);
  assert.equal(
    (
      await post([
        { ...e, type: "REVIEW_SUCCEEDED", properties: { model: "fake" } },
      ])
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await post([
        { ...e, properties: { screen: "home", email: "private@example.test" } },
      ])
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await post([
        e,
        {
          ...e,
          requestKey: randomUUID(),
          properties: { screen: "lesson", topic: "missing-topic" },
        },
      ])
    ).statusCode,
    400,
  );
  assert.equal((await statuses()).length, 0);
  const headers = {
    "x-analytics-client-id": "123456.123456",
    "x-analytics-session-id": "123456789",
  };
  assert.equal((await post([e], headers)).statusCode, 200);
  assert.equal((await post([e], headers)).statusCode, 200);
  assert.equal((await statuses()).length, 1);
  const row = (await db.query("SELECT * FROM business_events")).rows[0];
  assert.deepEqual(row.analytics_context, {
    clientId: "123456.123456",
    sessionId: 123456789,
  });
  assert.equal((await app.inject("/api/admin/analytics")).statusCode, 401);
  const status = await app.inject({
    url: "/api/admin/analytics",
    headers: { cookie },
  });
  assert.equal(status.statusCode, 200);
  assert.equal(
    status.json().catalog.length,
    Object.keys(eventProperties).length,
  );
});
test("GA4 payload excludes raw identity, entity IDs, extra properties and matches browser context", () => {
  const payload = ga4Payload({
    id: randomUUID(),
    type: "SCREEN_VIEWED",
    created_at: new Date(),
    analytics_id: analyticsId,
    actor_id: actor,
    entity_id: "private-record",
    email: "private@example.test",
    metadata: { screen: "home", code: "private code" },
    analytics_context: { clientId: "123.456", sessionId: 123 },
  });
  assert.equal(payload.client_id, "123.456");
  assert.equal(payload.user_id, analyticsId);
  assert.equal(payload.events[0].params.session_id, 123);
  assert.doesNotMatch(JSON.stringify(payload), /private|actor_id|entity_id/);
  assert.deepEqual(
    readAnalyticsContext({
      "x-analytics-client-id": "someone@example.test",
      "x-analytics-session-id": "NaN",
    }),
    {},
  );
  for (const type of Object.keys(eventProperties))
    assert.ok(/^[a-z][a-z0-9_]{0,39}$/.test(ga4EventName(type)));
  assert.equal(ga4Config({}), undefined);
  assert.throws(() =>
    ga4Config({ GA4_MEASUREMENT_ID: "bad", GA4_API_SECRET: "secret" }),
  );
});
test("async server result inherits the originating request context", async () => {
  await reset();
  const entity = randomUUID();
  await analyticsContext.run({ clientId: "123.456", sessionId: 123 }, () =>
    businessEvent(db, "EXECUTION_REQUESTED", actor, entity, "req", {
      mode: "judge",
      language: "python",
      problem: "sample",
    }),
  );
  await businessEvent(db, "EXECUTION_FINISHED", actor, entity, "done", {
    status: "SUCCEEDED",
    verdict: "ACCEPTED",
  });
  const row = (
    await db.query(
      "SELECT analytics_context FROM business_events WHERE event_key='done'",
    )
  ).rows[0];
  assert.deepEqual(row.analytics_context, {
    clientId: "123.456",
    sessionId: 123,
  });
});
test("GA4 batches at most 25, preserves original timestamps and validates before collecting", async () => {
  await reset();
  for (let i = 0; i < 27; i++) await add();
  const calls: { url: string; body: any }[] = [];
  const send: typeof fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options!.body as string) });
    return okFetch(url, options);
  };
  assert.equal((await deliverGa4(db, config, send)).processed, 27);
  assert.equal(calls.length, 4);
  assert.match(calls[0].url, /\/debug\//);
  assert.doesNotMatch(calls[1].url, /\/debug\//);
  assert.equal(calls[0].body.events.length, 25);
  assert.equal(calls[2].body.events.length, 2);
  assert.ok(
    calls[0].body.events.every((e: any) =>
      Number.isSafeInteger(e.timestamp_micros),
    ),
  );
  assert.ok((await statuses()).every((r) => r.status === "ACCEPTED"));
  assert.equal((await deliverGa4(db, config, send)).processed, 0);
});
test("validation rejects never collect and ambiguous delivery never retries", async () => {
  await reset();
  await add();
  let calls = 0;
  await deliverGa4(db, config, async () => {
    calls++;
    return Response.json({
      validationMessages: [{ validationCode: "VALUE_INVALID" }],
    });
  });
  assert.equal(calls, 1);
  assert.equal((await statuses())[0].status, "REJECTED");
  await reset();
  await add();
  calls = 0;
  await deliverGa4(db, config, async (url, options) => {
    calls++;
    if (String(url).includes("/debug/")) return okFetch(url, options);
    throw Error("simulated response loss");
  });
  assert.equal((await statuses())[0].status, "UNCERTAIN");
  assert.equal(calls, 2);
  await deliverGa4(db, config, async () => {
    throw Error("must not retry");
  });
  assert.equal((await statuses())[0].attempts, 1);
});
test("pre-collect transport failure backs off; disabled, expired and abandoned leases never collect", async () => {
  await reset();
  await add();
  await deliverGa4(db, undefined, async () => {
    throw Error("disabled");
  });
  assert.equal((await statuses())[0].attempts, 0);
  await deliverGa4(db, config, async () => {
    throw Error("validation unavailable");
  });
  assert.equal((await statuses())[0].status, "PENDING");
  assert.equal((await statuses())[0].last_code, "VALIDATION_UNAVAILABLE");
  assert.equal((await deliverGa4(db, config, okFetch)).processed, 0);
  await db.query(
    "UPDATE business_events SET created_at=now()-interval '73 hours'",
  );
  await deliverGa4(db, config, okFetch);
  assert.equal((await statuses())[0].status, "EXPIRED");
  await reset();
  await add();
  await db.query(
    "UPDATE analytics_deliveries SET status='PROCESSING',lease_until=now()-interval '1 second'",
  );
  await deliverGa4(db, config, async () => {
    throw Error("must not resend");
  });
  assert.equal((await statuses())[0].status, "UNCERTAIN");
});
test("Redash views expose pseudonymous data, all dashboard SQL runs, PUBLIC cannot select views", async () => {
  await reset();
  await add();
  const row = (await db.query("SELECT * FROM analytics_events")).rows[0];
  assert.equal(row.user_id, analyticsId);
  assert.notEqual(row.user_id, actor);
  assert.doesNotMatch(
    JSON.stringify(row),
    /admin@example|actor_id|analytics_context|entity_id/,
  );
  for (const q of JSON.parse(
    readFileSync(
      new URL("../../../scripts/redash-queries.json", import.meta.url),
      "utf8",
    ),
  )) {
    // Production uses algostep; the isolated database uses public.
    await db.query(
      q.query.replaceAll("algostep.analytics_", "public.analytics_"),
    );
  }
  await db.query("CREATE ROLE analytics_test_reader");
  assert.equal(
    (
      await db.query(
        "SELECT has_table_privilege('analytics_test_reader','analytics_events','SELECT') AS allowed",
      )
    ).rows[0].allowed,
    false,
  );
});
