import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { database, type DB } from "../src/db.js";
import { seed } from "../src/content.js";
import { createApp } from "../src/app.js";
import {
  id,
  kstMonth,
  nextReset,
  analysis,
  cleanExpired,
} from "../src/domain.js";
import { processReview } from "../src/review-worker.js";
import { snapshotSvg } from "../src/snapshot-svg.js";
import { topicQuizzes } from "../src/quiz-bank.js";
let db: DB, app: Awaited<ReturnType<typeof createApp>>;
const origin = "http://localhost:5173",
  runner = "test-runner-token-with-more-than-32-characters";
type Identity = { cookie: string; csrf: string; user: string };
async function login(name: string): Promise<Identity> {
  const r = await app.inject({
    method: "POST",
    url: "/api/auth/google",
    headers: { origin },
    payload: { credential: "integration-" + name },
  });
  assert.equal(r.statusCode, 200, r.body);
  return {
    cookie: String(r.headers["set-cookie"]).split(";")[0],
    csrf: r.json().csrf,
    user: r.json().user.id,
  };
}
function request(who: Identity, method: any, url: string, payload?: any) {
  return app.inject({
    method,
    url,
    headers: { origin, cookie: who.cookie, "x-csrf-token": who.csrf },
    payload,
  });
}
async function record(who: Identity) {
  const r = await request(who, "POST", "/api/records", {
    problemId: "binary-search-v1",
    language: "python",
  });
  assert.equal(r.statusCode, 200, r.body);
  return r.json();
}
before(async () => {
  process.env.NODE_ENV = "test";
  db = await database(process.env.TEST_DATABASE_URL);
  await seed(db);
  app = await createApp({
    db,
    origin,
    googleClientId: "test",
    sessionSecret: "test-secret",
    runnerToken: runner,
    llmEnabled: true,
    verifyGoogle: async (t) => ({
      sub: t,
      email: t + "@example.test",
      name: t,
    }),
  });
});
after(async () => {
  await app.close();
  await db.close();
});
test("anonymous access and CSRF mutations are blocked", async () => {
  assert.equal((await app.inject("/api/problems")).statusCode, 401);
  const u = await login("csrf");
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/records",
        headers: { cookie: u.cookie, origin },
        payload: { problemId: "binary-search-v1", language: "python" },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (await request(u, "GET", "/api/problems")).json().problems.length,
    47,
  );
});
test("one user cannot read, edit or delete another user record", async () => {
  const a = await login("owner"),
    b = await login("intruder"),
    r = await record(a);
  for (const method of ["GET", "DELETE"])
    assert.equal(
      (await request(b, method, "/api/records/" + r.id)).statusCode,
      404,
    );
  assert.equal(
    (
      await request(b, "PATCH", "/api/records/" + r.id, {
        source: "bad",
        language: "python",
        revision: 0,
      })
    ).statusCode,
    404,
  );
});
test("autosave optimistic locking and immutable execution snapshots", async () => {
  const u = await login("snap"),
    r = await record(u);
  assert.equal(
    (
      await request(u, "PATCH", "/api/records/" + r.id, {
        source: "print(4)",
        language: "python",
        revision: 0,
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await request(u, "PATCH", "/api/records/" + r.id, {
        source: "stale",
        language: "python",
        revision: 0,
      })
    ).statusCode,
    409,
  );
  const p = { requestKey: "run-snapshot-1", revision: 1 };
  const e = (
    await request(u, "POST", `/api/records/${r.id}/executions`, p)
  ).json();
  const again = (
    await request(u, "POST", `/api/records/${r.id}/executions`, p)
  ).json();
  assert.equal(e.id, again.id);
  await request(u, "PATCH", "/api/records/" + r.id, {
    source: "print(7)",
    language: "python",
    revision: 1,
  });
  assert.equal(
    (
      await db.query("SELECT source FROM code_snapshots WHERE id=$1", [
        e.snapshot_id,
      ])
    ).rows[0].source,
    "print(4)",
  );
  assert.equal(
    (await request(u, "GET", "/api/records")).json().records.length,
    1,
  );
});
test("monthly free review reservations cap concurrent requests at three", async () => {
  const u = await login("quota"),
    r = await record(u);
  const results = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      request(u, "POST", `/api/records/${r.id}/reviews`, {
        requestKey: `review-quota-${i}`,
        revision: 0,
      }),
    ),
  );
  assert.equal(results.filter((x) => x.statusCode === 200).length, 3);
  assert.equal(results.filter((x) => x.statusCode === 402).length, 2);
  const usage = (await request(u, "GET", "/api/review-usage")).json();
  assert.equal(usage.reserved, 3);
  assert.equal(usage.consumed, 0);
  const first = results[0].json();
  const repeat = await request(u, "POST", `/api/records/${r.id}/reviews`, {
    requestKey: "review-quota-0",
    revision: 0,
  });
  assert.equal(repeat.json().id, first.id);
  await request(u, "DELETE", "/api/records/" + r.id);
  assert.equal(
    (await request(u, "GET", "/api/review-usage")).json().reserved,
    0,
  );
});
test("LLM payload has only the three approved inputs; success consumes and deletion does not refund", async () => {
  const u = await login("review-success"),
    r = await record(u);
  await request(u, "POST", `/api/records/${r.id}/reviews`, {
    requestKey: "successful-review",
    revision: 0,
  });
  let payload: any;
  await processReview(db, {
    provider: "gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
    key: "test",
    model: "test",
    fetcher: (async (_url, options) => {
      payload = JSON.parse(String(options?.body));
      return new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      logicalErrors: "오류 설명",
                      efficiencyImprovements: "개선 설명",
                      alternativeCode: "print(4)",
                    }),
                  },
                ],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 4000,
            candidatesTokenCount: 1500,
            thoughtsTokenCount: 500,
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch,
  });
  assert.deepEqual(
    Object.keys(JSON.parse(payload.contents[0].parts[0].text)).sort(),
    ["problem", "recommendedCode", "userCode"],
  );
  assert.equal(
    (await request(u, "GET", "/api/review-usage")).json().consumed,
    1,
  );
  await request(u, "DELETE", "/api/records/" + r.id);
  assert.equal(
    (await request(u, "GET", "/api/review-usage")).json().consumed,
    1,
  );
  const tokens = (
    await db.query(
      "SELECT input_tokens,output_tokens,thinking_tokens FROM review_api_usage WHERE provider='gemini'",
    )
  ).rows;
  assert.equal(tokens.length, 1);
  assert.equal(Number(tokens[0].input_tokens), 4000);
  const events = (
    await db.query(
      "SELECT * FROM review_credit_events WHERE allowance_id IN (SELECT id FROM review_allowances WHERE user_id=$1) AND type='CONSUME'",
      [u.user],
    )
  ).rows;
  assert.equal(events.length, 1);
  assert.equal(events[0].review_id, null);
});
test("LLM failure releases reservation without consuming quota", async () => {
  const u = await login("review-failure"),
    r = await record(u);
  await request(u, "POST", `/api/records/${r.id}/reviews`, {
    requestKey: "failed-review",
    revision: 0,
  });
  await processReview(db, {
    url: "https://llm.example.test",
    key: "test",
    model: "test",
    fetcher: (async () =>
      new Response("error", { status: 500 })) as typeof fetch,
  });
  const usage = (await request(u, "GET", "/api/review-usage")).json();
  assert.equal(usage.reserved, 0);
  assert.equal(usage.consumed, 0);
});
test("global VM claims never exceed ten and stale result tokens are rejected", async () => {
  await db.query("UPDATE executions SET status='FAILED' WHERE status='QUEUED'");
  const u = await login("queue"),
    r = await record(u);
  for (let i = 0; i < 12; i++)
    await request(u, "POST", `/api/records/${r.id}/executions`, {
      requestKey: `queue-job-${i}`,
      revision: 0,
    });
  const claims = await Promise.all(
    Array.from({ length: 12 }, () =>
      app.inject({
        method: "POST",
        url: "/api/internal/claim",
        headers: { authorization: "Bearer " + runner },
        payload: {},
      }),
    ),
  );
  for (const c of claims) assert.equal(c.statusCode, 200, c.body);
  const jobs = claims.map((c) => c.json().job).filter(Boolean);
  assert.equal(jobs.length, 10);
  const result = await app.inject({
    method: "POST",
    url: `/api/internal/executions/${jobs[0].id}/result`,
    headers: { authorization: "Bearer " + runner },
    payload: { token: id(), systemError: "STALE" },
  });
  assert.equal(result.json().accepted, false);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/internal/claim",
        payload: {},
      })
    ).statusCode,
    401,
  );
  await request(u, "DELETE", "/api/records/" + r.id);
});
test("managed worker claims enforce host identity, stop fencing and two slots", async () => {
  const keys = [
    "WORKER_AUTOSCALE",
    "GCP_PROJECT",
    "WORKER_ZONE",
    "WORKER_NAMES",
    "RUNNER_SLOTS_PER_HOST",
  ];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const u = await login("managed-fleet"),
    r = await record(u);
  try {
    Object.assign(process.env, {
      WORKER_AUTOSCALE: "true",
      GCP_PROJECT: "algostep",
      WORKER_ZONE: "us-central1-a",
      WORKER_NAMES: "worker-1,worker-2",
      RUNNER_SLOTS_PER_HOST: "2",
    });
    await db.query(
      "UPDATE executions SET status='FAILED' WHERE status IN ('QUEUED','RUNNING')",
    );
    await db.query(
      "INSERT INTO worker_hosts(name,desired) VALUES('worker-1','RUNNING'),('worker-2','STOPPED')",
    );
    for (let i = 0; i < 4; i++)
      await request(u, "POST", `/api/records/${r.id}/executions`, {
        requestKey: `managed-${i}`,
        revision: 0,
      });
    const claim = async (workerName?: string) =>
      (
        await app.inject({
          method: "POST",
          url: "/api/internal/claim",
          headers: { authorization: "Bearer " + runner },
          payload: { workerName },
        })
      ).json().job;
    assert.equal(await claim(), null);
    assert.equal(await claim("unknown"), null);
    assert.equal(await claim("worker-2"), null);
    assert.ok(await claim("worker-1"));
    assert.ok(await claim("worker-1"));
    assert.equal(await claim("worker-1"), null);
    await db.query(
      "UPDATE worker_hosts SET desired='RUNNING',action='STOP' WHERE name='worker-2'",
    );
    assert.equal(await claim("worker-2"), null);
    await db.query("UPDATE worker_hosts SET action=NULL WHERE name='worker-2'");
    assert.ok(await claim("worker-2"));
  } finally {
    for (const k of keys)
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    await request(u, "DELETE", "/api/records/" + r.id);
  }
});
test("100-record cap evicts oldest; expired records cannot be read and are purged", async () => {
  const u = await login("retention");
  const ids = Array.from({ length: 100 }, () => id());
  for (let i = 0; i < 100; i++)
    await db.query(
      "INSERT INTO records(id,user_id,problem_id,language,source,created_at) VALUES($1,$2,'binary-search-v1','python','',now()-($3::int * interval '1 minute'))",
      [ids[i], u.user, 101 - i],
    );
  await record(u);
  assert.equal(
    (await request(u, "GET", "/api/records")).json().records.length,
    100,
  );
  assert.equal(
    (await request(u, "GET", "/api/records/" + ids[0])).statusCode,
    404,
  );
  await db.query(
    "UPDATE records SET expires_at=now()-interval '1 second' WHERE id=$1",
    [ids[1]],
  );
  assert.equal(
    (await request(u, "GET", "/api/records/" + ids[1])).statusCode,
    404,
  );
  await cleanExpired(db);
  assert.equal(
    (await db.query("SELECT id FROM records WHERE id=$1", [ids[1]])).rows
      .length,
    0,
  );
});
test("KST review month boundary is exact", () => {
  assert.equal(kstMonth(new Date("2026-09-30T14:59:59Z")), "2026-09");
  assert.equal(kstMonth(new Date("2026-09-30T15:00:00Z")), "2026-10");
  assert.equal(
    nextReset(new Date("2026-09-12T00:00:00Z")),
    "2026-09-30T15:00:00.000Z",
  );
});
test("free complexity analysis never invents bounds for unknown code", () => {
  assert.equal(
    analysis("python", "x", "y", { complexity: "O(n)|O(n)" }).status,
    "UNSUPPORTED",
  );
  assert.equal(
    analysis("python", "x", "x", { complexity: "O(n)|O(n)" }).time,
    "O(n)",
  );
});
test("PDF snapshots escape untrusted labels and ignore invalid graph edges", () => {
  const svg = snapshotSvg(
    { locals: { values: ["<script>alert(1)</script>"] } },
    "tree",
  );
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("&lt;script&gt;"));
  assert.doesNotThrow(() =>
    snapshotSvg({ locals: { graph: [[999, -1, "bad"], []] } }, "bfs"),
  );
});
test("quiz hides answer until submission and repeated request returns original result", async () => {
  const u = await login("quiz");
  const topics = (await request(u, "GET", "/api/topics")).json().topics;
  assert.equal(topics[0].quiz.answer, undefined);
  const a = (
    await request(u, "POST", "/api/quiz/binary-search", {
      answer: 0,
      requestKey: "quiz-request-one",
    })
  ).json();
  const b = (
    await request(u, "POST", "/api/quiz/binary-search", {
      answer: 1,
      requestKey: "quiz-request-one",
    })
  ).json();
  assert.equal(a.correct, true);
  assert.deepEqual(a, b);
});

test("every topic has three distinct quizzes and extra answers remain server-only", async () => {
  const u = await login("expanded-quiz");
  const topics = (await request(u, "GET", "/api/topics")).json().topics;
  assert.equal(topics.length, 47);
  for (const topic of topics) {
    assert.equal(topic.quizzes.length, 3, topic.id);
    assert.equal(new Set(topic.quizzes.map((q: any) => q.question)).size, 3);
    for (const q of topic.quizzes) {
      assert.equal(q.answer, undefined);
      assert.equal(q.explanation, undefined);
      assert.equal(new Set(q.options).size, 3);
    }
  }
  const raw = (await db.query("SELECT * FROM topics WHERE id='bfs'")).rows[0];
  const q = topicQuizzes(raw as any)[1];
  const result = await request(u, "POST", "/api/quiz/bfs", {
    questionId: q.id,
    answer: q.answer,
    requestKey: "expanded-bfs-one",
  });
  assert.equal(result.json().correct, true);
  assert.equal(result.json().explanation, q.explanation);
  assert.equal(
    (
      await request(u, "POST", "/api/quiz/bfs", {
        questionId: "unknown",
        answer: 0,
        requestKey: "expanded-bfs-bad",
      })
    ).statusCode,
    404,
  );
});
