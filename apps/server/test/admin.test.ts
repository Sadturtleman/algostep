import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { database, type DB } from "../src/db.js";
import { createApp } from "../src/app.js";
import { kstDate, reportRange } from "../src/admin.js";
import { businessEvent } from "../src/business.js";
import { seed } from "../src/content.js";
import { id } from "../src/domain.js";
process.env.NODE_ENV = "test";
let db: DB, app: Awaited<ReturnType<typeof createApp>>;
const origin = "http://localhost:5173";
type Login = { cookie: string; csrf: string; id: string };
let admin: Login, student: Login, other: Login;
async function login(name: string) {
  const r = await app.inject({
    method: "POST",
    url: "/api/auth/google",
    headers: { origin },
    payload: { credential: "test-token-" + name },
  });
  assert.equal(r.statusCode, 200, r.body);
  return {
    cookie: String(r.headers["set-cookie"]).split(";")[0],
    csrf: r.json().csrf,
    id: r.json().user.id,
  };
}
const request = (who: Login, method: any, url: string, payload?: any) =>
  app.inject({
    method,
    url,
    payload,
    headers: { origin, cookie: who.cookie, "x-csrf-token": who.csrf },
  });
before(async () => {
  db = await database();
  await seed(db);
  app = await createApp({
    db,
    origin,
    googleClientId: "test",
    sessionSecret: "test",
    runnerToken: "runner",
    llmEnabled: false,
    adminEmails: ["admin@example.test"],
    operationsToken: "operations",
    verifyGoogle: async (token) => ({
      sub: token,
      email: token.replace("test-token-", "") + "@example.test",
      name: token,
    }),
  });
  admin = await login("admin");
  student = await login("student");
  other = await login("other");
});
after(async () => {
  await app.close();
  await db.close();
});
test("admin APIs require a verified allowlisted session and CSRF", async () => {
  assert.equal((await app.inject("/api/admin/dashboard")).statusCode, 401);
  for (const path of [
    "/dashboard",
    "/users",
    "/events",
    "/inquiries",
    "/costs",
  ])
    assert.equal(
      (await request(student, "GET", "/api/admin" + path)).statusCode,
      403,
    );
  assert.equal(
    (await request(student, "POST", "/api/admin/costs/import", { entries: [] }))
      .statusCode,
    403,
  );
  assert.equal(
    (await request(student, "PATCH", "/api/admin/inquiries/" + id(), {}))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/admin/costs/import",
        headers: { origin, cookie: admin.cookie },
        payload: { entries: [] },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (await request(admin, "GET", "/api/me")).json().user.isAdmin,
    true,
  );
  assert.equal(
    (await request(student, "GET", "/api/me")).json().user.isAdmin,
    false,
  );
  assert.equal(
    (await request(admin, "GET", "/api/admin/users")).json().rows.length,
    3,
  );
});
test("KST calendar boundaries and date validation are explicit", () => {
  assert.equal(kstDate(new Date("2026-09-30T14:59:59Z")), "2026-09-30");
  assert.equal(kstDate(new Date("2026-09-30T15:00:00Z")), "2026-10-01");
  assert.deepEqual(reportRange({}, new Date("2026-09-30T15:00:00Z")), {
    from: "2026-10-01",
    to: "2026-10-01",
    grain: "day",
  });
  assert.throws(() => reportRange({ from: "2026-02-30" }));
  assert.throws(() => reportRange({ from: "2025-01-01", to: "2026-09-19" }));
  assert.throws(() => reportRange({ from: "2026-09-19", to: "2026-09-18" }));
});
test("visits deduplicate across tabs and sessions; period buckets count distinct users", async () => {
  for (let i = 0; i < 3; i++)
    assert.equal(
      (await request(student, "POST", "/api/analytics/visit", {})).statusCode,
      200,
    );
  await login("student");
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM visitor_days WHERE user_id=$1",
        [student.id],
      )
    ).rows[0].n,
    1,
  );
  await db.query(
    "INSERT INTO visitor_days(user_id,day) VALUES($1,((now() AT TIME ZONE 'Asia/Seoul')::date-1)) ON CONFLICT DO NOTHING",
    [student.id],
  );
  const today = kstDate(),
    from = new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10);
  for (const grain of ["day", "week", "month"]) {
    const r = await request(
      admin,
      "GET",
      `/api/admin/dashboard?from=${from}&to=${today}&grain=${grain}`,
    );
    assert.equal(r.statusCode, 200, r.body);
    const d = r.json();
    assert.equal(d.counts.cumulative, 3);
    assert.equal(d.counts.daily, 3);
    assert.equal(d.counts.period_visitors, 3);
    assert.equal(d.counts.users, 3);
    assert.ok(d.counts.weekly <= 3 && d.counts.monthly <= 3);
    if (grain === "day")
      assert.deepEqual(
        d.series.map((r: any) => r.visitors),
        [1, 3],
      );
  }
  const empty = await request(
    admin,
    "GET",
    "/api/admin/dashboard?from=2026-01-01&to=2026-01-02",
  );
  assert.equal(empty.json().series.length, 2);
  assert.equal(empty.json().series[0].visitors, null);
  assert.equal(
    (await request(admin, "GET", "/api/admin/dashboard?grain=invalid"))
      .statusCode,
    400,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM business_events WHERE type='USER_REGISTERED' AND actor_id=$1",
        [student.id],
      )
    ).rows[0].n,
    1,
  );
});
test("inquiry ownership, idempotency, reply visibility and conflicting updates", async () => {
  const input = {
    requestKey: "support-test-001",
    category: "bug",
    subject: "그래프 오류",
    body: "PRIVATE_INQUIRY_CONTENT",
  };
  const created = await request(student, "POST", "/api/support", input);
  assert.equal(created.statusCode, 200, created.body);
  const ticket = created.json();
  assert.equal(
    (await request(student, "GET", `/api/support/${ticket.id}`)).json().body,
    "PRIVATE_INQUIRY_CONTENT",
  );
  assert.equal(
    (await request(other, "GET", `/api/support/${ticket.id}`)).statusCode,
    404,
  );
  assert.equal(
    (await request(student, "POST", "/api/support", input)).json().id,
    ticket.id,
  );
  assert.equal(
    (await request(other, "GET", "/api/support")).json().rows.length,
    0,
  );
  const adminList = await request(
    admin,
    "GET",
    "/api/admin/inquiries?status=OPEN",
  );
  assert.equal(adminList.json().rows[0].email, "student@example.test");
  assert.equal(
    (
      await request(admin, "PATCH", "/api/admin/inquiries/" + ticket.id, {
        revision: 0,
        status: "RESOLVED",
        reply: "",
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await request(admin, "PATCH", "/api/admin/inquiries/" + ticket.id, {
        revision: 0,
        status: "RESOLVED",
        reply: "문제를 해결했어요.",
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await request(admin, "PATCH", "/api/admin/inquiries/" + ticket.id, {
        revision: 0,
        status: "OPEN",
        reply: "stale",
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (await request(student, "GET", "/api/support")).json().rows[0].reply,
    "문제를 해결했어요.",
  );
  const events = (await request(admin, "GET", "/api/admin/events")).json();
  assert.ok(!JSON.stringify(events).includes("PRIVATE_INQUIRY_CONTENT"));
  assert.equal(
    events.rows.filter(
      (r: any) => r.type === "INQUIRY_CREATED" && r.entity_id === ticket.id,
    ).length,
    1,
  );
});
test("cost import is atomic and repeatable; currencies and refunds stay separate", async () => {
  const day = kstDate();
  const entries = [
    {
      sourceKey: "gcp-day-krw",
      usageDate: day,
      service: "Compute Engine",
      currency: "KRW",
      amount: 1000,
      source: "billing-export",
    },
    {
      sourceKey: "gemini-day-usd",
      usageDate: day,
      service: "Gemini",
      currency: "USD",
      amount: 1.5,
      source: "verified-invoice",
    },
  ];
  const imported = await request(admin, "POST", "/api/admin/costs/import", {
    entries,
  });
  assert.equal(imported.statusCode, 200, imported.body);
  assert.equal(
    (await request(admin, "POST", "/api/admin/costs/import", { entries }))
      .statusCode,
    200,
  );
  assert.equal(
    (
      await request(admin, "POST", "/api/admin/costs/import", {
        entries: [entries[0], entries[0]],
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await request(admin, "POST", "/api/admin/costs/import", {
        entries: [{ ...entries[0], usageDate: "2026-02-30" }],
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/operations/costs/import",
        payload: { entries },
      })
    ).statusCode,
    401,
  );
  const operational = await app.inject({
    method: "POST",
    url: "/api/operations/costs/import",
    headers: { authorization: "Bearer operations" },
    payload: { entries: [{ ...entries[0], amount: 900 }] },
  });
  assert.equal(operational.statusCode, 200);
  await db.query(
    "INSERT INTO revenue_entries(id,provider_event_id,kind,currency,amount,occurred_at) VALUES($1,'payment-001','PAYMENT','KRW',3000,$3::date::timestamp AT TIME ZONE 'Asia/Seoul'),($2,'refund-001','REFUND','KRW',1000,($3::date::timestamp+interval '1 minute') AT TIME ZONE 'Asia/Seoul'),($4,'previous-day','PAYMENT','KRW',9999,($3::date::timestamp-interval '1 second') AT TIME ZONE 'Asia/Seoul'),($5,'next-day','PAYMENT','KRW',9999,($3::date+1)::timestamp AT TIME ZONE 'Asia/Seoul')",
    [id(), id(), day, id(), id()],
  );
  const r = await request(
    admin,
    "GET",
    `/api/admin/dashboard?from=${day}&to=${day}`,
  );
  assert.equal(r.statusCode, 200, r.body);
  const d = r.json();
  assert.equal(d.costs.length, 2);
  assert.equal(
    Number(d.costs.find((v: any) => v.currency === "KRW").amount),
    900,
  );
  assert.equal(
    Number(d.costs.find((v: any) => v.currency === "USD").amount),
    1.5,
  );
  assert.equal(Number(d.revenue[0].net), 2000);
  assert.equal(Number(d.revenue[0].refunds), 1000);
  assert.equal(d.paymentEnabled, false);
  const costs = await request(admin, "GET", "/api/admin/costs");
  assert.equal(costs.statusCode, 200, costs.body);
  assert.equal(costs.json().rows.length, 2);
});
test("business events remain after record deletion and retry keys do not inflate activity", async () => {
  const r = (
    await request(student, "POST", "/api/records", {
      problemId: "binary-search-v1",
      language: "python",
    })
  ).json();
  assert.ok(r.id);
  const payload = { requestKey: "admin-log-execution", revision: 0 };
  const first = await request(
    student,
    "POST",
    `/api/records/${r.id}/executions`,
    payload,
  );
  assert.equal(first.statusCode, 200, first.body);
  await request(student, "POST", `/api/records/${r.id}/executions`, payload);
  await request(student, "DELETE", "/api/records/" + r.id);
  const rows = (
    await db.query("SELECT type FROM business_events WHERE entity_id=$1", [
      first.json().id,
    ])
  ).rows;
  assert.deepEqual(
    rows.map((r) => r.type),
    ["EXECUTION_REQUESTED"],
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM business_events WHERE type='RECORD_DELETED' AND entity_id=$1",
        [r.id],
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(
    db.tx(async (tx) => {
      await businessEvent(tx, "LOGOUT", student.id, null, "rollback");
      throw new Error("rollback");
    }),
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM business_events WHERE event_key='rollback'",
      )
    ).rows[0].n,
    0,
  );
});
