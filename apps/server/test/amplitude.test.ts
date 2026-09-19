import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { database, type DB } from "../src/db.js";
import { businessEvent } from "../src/business.js";
import {
  amplitudeConfig,
  amplitudeEvent,
  deliverAmplitude,
  amplitudeStatus,
} from "../src/amplitude.js";
let db: DB;
const config = { apiKey: "test-amplitude-key", region: "US" as const };
before(async () => {
  db = await database();
});
after(async () => {
  await db.close();
});
const reset = () => db.query("DELETE FROM business_events");
const add = (key: string) => businessEvent(db, "LOGOUT", null, null, key);
const states = async () =>
  (await db.query("SELECT * FROM amplitude_deliveries ORDER BY event_id")).rows;
const success: typeof fetch = async (_url, options) =>
  new Response(
    JSON.stringify({
      code: 200,
      events_ingested: JSON.parse(String(options?.body)).events.length,
    }),
  );
test("both destinations are atomically deduplicated and rollback together", async () => {
  await reset();
  await add("same");
  await add("same");
  assert.equal((await states()).length, 1);
  assert.equal(
    (await db.query("SELECT * FROM analytics_deliveries")).rows.length,
    1,
  );
  await assert.rejects(
    db.tx(async (tx) => {
      await businessEvent(tx, "LOGOUT", null, null, "rollback");
      throw Error("rollback");
    }),
  );
  assert.equal((await states()).length, 1);
});
test("Amplitude batches at most ten and uses fixed regional hosts without exposing secrets", async () => {
  await reset();
  for (let i = 0; i < 12; i++) await add("batch-" + i);
  const sizes: number[] = [];
  await deliverAmplitude(
    db,
    { ...config, region: "EU" },
    async (url, options) => {
      assert.equal(url, "https://api.eu.amplitude.com/2/httpapi");
      const body = JSON.parse(String(options?.body));
      sizes.push(body.events.length);
      assert.equal(body.api_key, config.apiKey);
      assert.equal(body.events[0].session_id, -1);
      return success(url, options);
    },
  );
  assert.deepEqual(sizes, [10, 2]);
  assert.ok((await states()).every((r) => r.status === "INGESTED"));
  assert.doesNotMatch(
    JSON.stringify(await amplitudeStatus(db)),
    /test-amplitude-key/,
  );
});
test("ambiguous transport retries preserve payload and insert ID even after source changes", async () => {
  await reset();
  await add("retry");
  let original: any;
  await deliverAmplitude(db, config, async (_u, o) => {
    original = JSON.parse(String(o?.body)).events[0];
    throw Error("network");
  });
  assert.equal((await states())[0].status, "PENDING");
  await db.query(
    'UPDATE business_events SET analytics_context=\'{"clientId":"111.222","sessionId":123}\'',
  );
  await db.query(
    "UPDATE amplitude_deliveries SET available_at=now()-interval '1 second'",
  );
  await deliverAmplitude(db, config, async (u, o) => {
    assert.deepEqual(JSON.parse(String(o?.body)).events[0], original);
    return success(u, o);
  });
  assert.equal((await states())[0].status, "INGESTED");
  assert.equal((await states())[0].attempts, 2);
});
test("rate limits retry, invalid requests reject, stale attempts expire", async () => {
  for (const [code, status] of [
    [429, "PENDING"],
    [503, "PENDING"],
    [400, "REJECTED"],
  ] as const) {
    await reset();
    await add("status-" + code);
    await deliverAmplitude(
      db,
      config,
      async () => new Response("{}", { status: code }),
    );
    assert.equal((await states())[0].status, status);
  }
  await reset();
  await add("expired");
  await db.query(
    "UPDATE amplitude_deliveries SET first_attempt_at=now()-interval '7 days'",
  );
  await deliverAmplitude(db, config, async () => {
    throw Error("must not send");
  });
  assert.equal((await states())[0].status, "EXPIRED");
});
test("expired lease can retry with stable payload; missing configuration does not send", async () => {
  await reset();
  await add("lease");
  await db.query(
    "UPDATE amplitude_deliveries SET status='PROCESSING',lease_until=now()-interval '1 second'",
  );
  await deliverAmplitude(db, config, success);
  assert.equal((await states())[0].status, "INGESTED");
  assert.equal(amplitudeConfig({}), undefined);
  assert.throws(() =>
    amplitudeConfig({
      AMPLITUDE_API_KEY: "test-amplitude-key",
      AMPLITUDE_REGION: "other",
    }),
  );
  assert.throws(() => amplitudeEvent({ type: "UNKNOWN" }));
});
