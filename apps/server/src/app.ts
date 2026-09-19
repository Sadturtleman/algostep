import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { OAuth2Client } from "google-auth-library";
import { timingSafeEqual, randomBytes } from "node:crypto";
import { z } from "zod";
import type { DB } from "./db.js";
import {
  id,
  hash,
  DomainError,
  kstMonth,
  nextReset,
  ownRecord,
  snapshot,
  deleteRecord,
  analysis,
} from "./domain.js";
import { languages } from "./content.js";
import { renderPdf } from "./pdf.js";
import { externalize, hydrate, type ObjectStorage } from "./object-storage.js";
import { maintenance } from "./maintenance.js";

type Config = {
  db: DB;
  origin: string;
  googleClientId: string;
  sessionSecret: string;
  runnerToken: string;
  llmEnabled: boolean;
  production?: boolean;
  storage?: ObjectStorage;
  operationsToken?: string;
  verifyGoogle?: (
    token: string,
  ) => Promise<{ sub: string; email: string; name: string; nonce?: string }>;
};
const source = z.string().max(65536),
  key = z.string().min(8).max(100),
  uuid = z.string().uuid();
const codeInput = z.object({ language: z.enum(languages), source });
const traceStep = z.object({
  line: z.number().int().min(1),
  event: z.string().max(20),
  locals: z.record(z.string().max(100), z.unknown()),
  stack: z.array(z.string().max(120)).max(32),
});
const resultInput = z.object({
  verdict: z.enum([
    "AC",
    "WA",
    "CE",
    "RE",
    "TLE",
    "MLE",
    "OUTPUT_LIMIT",
    "COMPLETED",
  ]),
  diagnostics: z.string().max(65536).optional(),
  tests: z
    .array(
      z.object({
        input: z.string().max(65536),
        expected: z.string().max(65536).nullable(),
        actual: z.string().max(65536),
        stderr: z.string().max(65536),
        verdict: z.string().max(32),
        elapsedMs: z.number().nonnegative(),
        peakMemoryBytes: z.number().nonnegative(),
        trace: z.array(traceStep).max(2000).optional(),
        traceTruncated: z.boolean().optional(),
      }),
    )
    .max(100),
  traceSupport: z.enum(["PYTHON", "GDB", "JDI", "UNSUPPORTED"]),
  runnerImage: z.string().max(256),
});
export async function createApp(c: Config) {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
    bodyLimit: 2 * 1024 * 1024,
  });
  await app.register(cookie);
  await app.register(cors, { origin: c.origin, credentials: true });
  await app.register(rateLimit, { max: 240, timeWindow: "1 minute" });
  const google = new OAuth2Client(c.googleClientId);
  const verify =
    c.verifyGoogle ??
    (async (token: string) => {
      const ticket = await google.verifyIdToken({
        idToken: token,
        audience: c.googleClientId,
      });
      const p = ticket.getPayload();
      if (!p?.sub || !p.email || !p.email_verified)
        throw new Error("Invalid Google identity");
      return {
        sub: p.sub,
        email: p.email,
        name: p.name ?? p.email,
        nonce: (p as any).nonce,
      };
    });
  const sessionDigest = (token: string) => hash(c.sessionSecret + token);
  app.setErrorHandler((err: any, _req, reply) => {
    if (err instanceof z.ZodError)
      return reply
        .status(400)
        .send({ code: "INVALID_INPUT", message: "입력 형식을 확인해 주세요." });
    if (err instanceof DomainError)
      return reply
        .status(err.status)
        .send({ code: err.code, message: err.message });
    if (err.statusCode === 429)
      return reply
        .status(429)
        .send({ code: "RATE_LIMIT", message: "잠시 후 다시 시도해 주세요." });
    app.log.error({ err }, "request failed");
    return reply.status(500).send({
      code: "SYSTEM_ERROR",
      message:
        "요청을 처리하지 못했어요. 같은 요청의 상태를 다시 확인해 주세요.",
    });
  });
  app.addHook("preHandler", async (req: any, reply) => {
    if (!req.url.startsWith("/api/")) return;
    if (req.url.startsWith("/api/operations/")) {
      const token = String(req.headers.authorization ?? "").replace(
        /^Bearer /,
        "",
      );
      if (
        !c.operationsToken ||
        !timingSafeEqual(
          Buffer.from(hash(token)),
          Buffer.from(hash(c.operationsToken)),
        )
      )
        throw new DomainError(401, "UNAUTHORIZED", "인증이 필요해요.");
      return;
    }
    if (req.url.startsWith("/api/internal/")) {
      const token = String(req.headers.authorization ?? "").replace(
        /^Bearer /,
        "",
      );
      if (
        !c.runnerToken ||
        !timingSafeEqual(
          Buffer.from(hash(token)),
          Buffer.from(hash(c.runnerToken)),
        )
      )
        throw new DomainError(401, "UNAUTHORIZED", "인증이 필요해요.");
      return;
    }
    if (
      ["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      ["/api/health", "/api/config"].includes(req.url.split("?")[0])
    )
      return;
    if (req.method === "OPTIONS") return;
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.headers.origin !== c.origin
    )
      throw new DomainError(
        403,
        "ORIGIN_INVALID",
        "요청 출처를 확인할 수 없어요.",
      );
    if (["/api/auth/google", "/api/auth/challenge"].includes(req.url)) return;
    const token = req.cookies.session;
    if (!token)
      throw new DomainError(401, "AUTH_REQUIRED", "Google 로그인이 필요해요.");
    const { rows } = await c.db.query(
      "SELECT s.csrf,s.client,u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.expires_at>now()",
      [sessionDigest(token)],
    );
    if (!rows[0])
      throw new DomainError(401, "SESSION_EXPIRED", "다시 로그인해 주세요.");
    req.user = rows[0];
    if (
      rows[0].client === "android" &&
      !/^\/api\/(me|topics|quiz\/[^/?]+|auth\/logout)(\?|$)/.test(req.url)
    )
      throw new DomainError(
        403,
        "LEARNING_ONLY",
        "Android 앱에서는 설명과 퀴즈를 이용할 수 있어요.",
      );
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.headers["x-csrf-token"] !== rows[0].csrf
    )
      throw new DomainError(
        403,
        "CSRF_INVALID",
        "화면을 다시 열고 시도해 주세요.",
      );
  });
  const user = (req: any) => req.user.id as string;
  app.get("/api/operations/metrics", async () => ({
    executions: (
      await c.db.query(
        "SELECT status,count(*)::int AS count,min(created_at) AS oldest FROM executions GROUP BY status",
      )
    ).rows,
    reviews: (
      await c.db.query(
        "SELECT status,count(*)::int AS count,min(created_at) AS oldest FROM reviews GROUP BY status",
      )
    ).rows,
    pendingObjectDeletions: (
      await c.db.query("SELECT count(*)::int AS count FROM object_deletions")
    ).rows[0].count,
    migrations: (
      await c.db.query(
        "SELECT version,applied_at FROM schema_migrations ORDER BY version",
      )
    ).rows,
  }));
  app.post("/api/operations/maintenance", async () => {
    await maintenance(c.db, c.storage);
    return { ok: true };
  });
  app.get("/api/operations/ready", async () => {
    await c.db.query("SELECT 1");
    return { ok: true };
  });
  app.post(
    "/api/auth/challenge",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (_req, reply) => {
      const nonce = randomBytes(32).toString("hex");
      await c.db.query("DELETE FROM auth_challenges WHERE expires_at<=now()");
      await c.db.query(
        "INSERT INTO auth_challenges(nonce_hash,expires_at) VALUES($1,now()+interval '5 minutes')",
        [hash(nonce)],
      );
      reply.setCookie("auth_nonce", nonce, {
        httpOnly: true,
        secure: !!c.production,
        sameSite: "strict",
        path: "/api/auth",
        maxAge: 300,
      });
      return { nonce };
    },
  );
  app.get("/api/health", async () => ({ ok: true }));
  app.get("/api/config", async () => ({
    googleClientId: c.googleClientId,
    reviewEnabled: c.llmEnabled,
    paymentEnabled: false,
    languages: ["Python 3.10", "C++20", "Java 21"],
  }));
  app.post(
    "/api/auth/google",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      if (!c.googleClientId && !c.verifyGoogle)
        throw new DomainError(
          503,
          "AUTH_NOT_CONFIGURED",
          "Google 로그인 설정이 필요해요.",
        );
      const { credential, client } = z
        .object({
          credential: z.string().min(10).max(8192),
          client: z.enum(["web", "android"]).default("web"),
        })
        .parse(req.body);
      let p;
      try {
        p = await verify(credential);
      } catch {
        throw new DomainError(
          401,
          "GOOGLE_TOKEN_INVALID",
          "Google 인증을 확인하지 못했어요.",
        );
      }
      const token = randomBytes(32).toString("hex"),
        csrf = randomBytes(24).toString("hex");
      const account = await c.db.tx(async (db) => {
        if (client === "android") {
          const nonce = req.cookies.auth_nonce;
          if (!nonce || p.nonce !== nonce)
            throw new DomainError(
              401,
              "GOOGLE_TOKEN_INVALID",
              "다시 로그인해 주세요.",
            );
          const used = await db.query(
            "DELETE FROM auth_challenges WHERE nonce_hash=$1 AND expires_at>now() RETURNING nonce_hash",
            [hash(nonce)],
          );
          if (!used.rows.length)
            throw new DomainError(
              401,
              "GOOGLE_TOKEN_INVALID",
              "로그인 요청이 만료됐어요.",
            );
        }
        const { rows } = await db.query(
          "INSERT INTO users(id,google_subject,email,display_name) VALUES($1,$2,$3,$4) ON CONFLICT(google_subject) DO UPDATE SET email=excluded.email,display_name=excluded.display_name RETURNING *",
          [id(), p.sub, p.email, p.name],
        );
        await db.query(
          "INSERT INTO sessions(id,user_id,csrf,expires_at,client) VALUES($1,$2,$3,now()+interval '7 days',$4)",
          [sessionDigest(token), rows[0].id, csrf, client],
        );
        return rows[0];
      });
      reply.setCookie("session", token, {
        httpOnly: true,
        secure: !!c.production,
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 86400,
      });
      return { user: account, csrf };
    },
  );
  app.get("/api/me", async (req: any) => ({
    user: {
      id: req.user.id,
      name: req.user.display_name,
      email: req.user.email,
    },
    csrf: req.user.csrf,
  }));
  app.post("/api/auth/logout", async (req: any, reply) => {
    await c.db.query("DELETE FROM sessions WHERE id=$1", [
      sessionDigest(req.cookies.session),
    ]);
    reply.clearCookie("session", { path: "/" });
    return { ok: true };
  });
  app.get("/api/topics", async () => ({
    topics: (
      await c.db.query(
        "SELECT id,title,category,priority,body,complexity,quiz-'answer'-'explanation' AS quiz FROM topics ORDER BY priority,id",
      )
    ).rows,
  }));
  app.post("/api/quiz/:topic", async (req: any) => {
    const v = z
      .object({ answer: z.number().int().min(0).max(10), requestKey: key })
      .parse(req.body);
    const { rows } = await c.db.query("SELECT * FROM topics WHERE id=$1", [
      req.params.topic,
    ]);
    if (!rows[0])
      throw new DomainError(404, "NOT_FOUND", "학습 내용을 찾을 수 없어요.");
    const q = rows[0].quiz;
    if (v.answer >= q.options.length)
      throw new DomainError(400, "INVALID_INPUT", "선택지를 확인해 주세요.");
    const existing = await c.db.query(
      "SELECT * FROM quiz_attempts WHERE user_id=$1 AND request_key=$2",
      [user(req), v.requestKey],
    );
    if (existing.rows[0]) {
      const old = existing.rows[0];
      return {
        correct: old.correct,
        answer: old.question_snapshot.answer,
        explanation: old.question_snapshot.explanation,
      };
    }
    await c.db.query(
      "INSERT INTO quiz_attempts(id,user_id,topic_id,answer,correct,request_key,question_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING",
      [
        id(),
        user(req),
        req.params.topic,
        v.answer,
        v.answer === q.answer,
        v.requestKey,
        JSON.stringify(q),
      ],
    );
    return {
      correct: v.answer === q.answer,
      answer: q.answer,
      explanation: q.explanation,
    };
  });
  app.get("/api/problems", async () => ({
    problems: (await c.db.query("SELECT * FROM problems ORDER BY id")).rows,
  }));
  app.get("/api/records", async (req) => ({
    records: (
      await c.db.query(
        "SELECT r.*,p.title,e.status AS execution_status FROM records r JOIN problems p ON p.id=r.problem_id LEFT JOIN executions e ON e.id=r.latest_execution_id WHERE r.user_id=$1 AND r.expires_at>now() ORDER BY r.updated_at DESC",
        [user(req)],
      )
    ).rows,
  }));
  app.post("/api/records", async (req) => {
    const input = z
      .object({ problemId: z.string().max(100), language: z.enum(languages) })
      .parse(req.body);
    return c.db.tx(async (db) => {
      await db.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        user(req),
      ]);
      const p = (
        await db.query("SELECT * FROM problems WHERE id=$1", [input.problemId])
      ).rows[0];
      if (!p) throw new DomainError(404, "NOT_FOUND", "문제를 찾을 수 없어요.");
      const all = (
        await db.query(
          "SELECT id,expires_at FROM records WHERE user_id=$1 ORDER BY created_at,id FOR UPDATE",
          [user(req)],
        )
      ).rows;
      const live = all.filter((r) => new Date(r.expires_at) > new Date());
      for (const r of all.filter((r) => new Date(r.expires_at) <= new Date()))
        await deleteRecord(db, r.id);
      for (const r of live.slice(0, Math.max(0, live.length - 99)))
        await deleteRecord(db, r.id);
      const { rows } = await db.query(
        "INSERT INTO records(id,user_id,problem_id,language,source) VALUES($1,$2,$3,$4,$5) RETURNING *",
        [id(), user(req), p.id, input.language, p.starters[input.language]],
      );
      return rows[0];
    });
  });
  app.get("/api/records/:id", async (req: any) => {
    const r = await ownRecord(c.db, user(req), uuid.parse(req.params.id));
    const reviews = (
      await c.db.query(
        "SELECT v.*,s.source,s.language FROM reviews v JOIN code_snapshots s ON s.id=v.snapshot_id WHERE v.record_id=$1 ORDER BY v.created_at DESC",
        [r.id],
      )
    ).rows;
    const execution = r.latest_execution_id
      ? (
          await c.db.query("SELECT * FROM executions WHERE id=$1", [
            r.latest_execution_id,
          ])
        ).rows[0]
      : null;
    return { ...r, reviews, execution: await hydrate(c.storage, execution) };
  });
  app.patch("/api/records/:id", async (req: any) => {
    const v = codeInput
      .extend({ revision: z.number().int().nonnegative() })
      .parse(req.body);
    await ownRecord(c.db, user(req), uuid.parse(req.params.id));
    const { rows } = await c.db.query(
      "UPDATE records SET source=$1,language=$2,revision=revision+1,updated_at=now() WHERE id=$3 AND user_id=$4 AND revision=$5 AND expires_at>now() RETURNING *",
      [v.source, v.language, req.params.id, user(req), v.revision],
    );
    if (!rows[0])
      throw new DomainError(
        409,
        "SAVE_CONFLICT",
        "다른 화면에서 코드가 변경됐어요. 현재 코드를 복사한 뒤 최신 기록을 다시 열어 주세요.",
      );
    return rows[0];
  });
  app.delete("/api/records/:id", async (req: any) => {
    await c.db.tx(async (db) => {
      await db.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        user(req),
      ]);
      await ownRecord(db, user(req), uuid.parse(req.params.id));
      await deleteRecord(db, req.params.id);
    });
    return { ok: true };
  });
  app.post("/api/records/:id/executions", async (req: any) => {
    const v = z
      .object({
        requestKey: key,
        revision: z.number().int().nonnegative(),
        mode: z.enum(["judge", "custom"]).default("judge"),
        input: z.string().max(65536).optional(),
      })
      .parse(req.body);
    return c.db.tx(async (db) => {
      await db.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        user(req),
      ]);
      const r = await ownRecord(db, user(req), uuid.parse(req.params.id));
      const exists = (
        await db.query(
          "SELECT * FROM executions WHERE record_id=$1 AND request_key=$2",
          [r.id, v.requestKey],
        )
      ).rows[0];
      if (exists) return exists;
      if (r.revision !== v.revision)
        throw new DomainError(
          409,
          "SAVE_CONFLICT",
          "최신 코드가 저장된 후 실행해 주세요.",
        );
      const snap = await snapshot(db, r),
        run = id();
      await db.query(
        "INSERT INTO executions(id,record_id,snapshot_id,request_key,mode,custom_input) VALUES($1,$2,$3,$4,$5,$6)",
        [run, r.id, snap, v.requestKey, v.mode, v.input ?? ""],
      );
      await db.query(
        "UPDATE records SET latest_execution_id=$1,updated_at=now() WHERE id=$2",
        [run, r.id],
      );
      return (await db.query("SELECT * FROM executions WHERE id=$1", [run]))
        .rows[0];
    });
  });
  app.get("/api/executions/:id", async (req: any) => {
    const { rows } = await c.db.query(
      "SELECT e.* FROM executions e JOIN records r ON r.id=e.record_id WHERE e.id=$1 AND r.user_id=$2 AND r.expires_at>now()",
      [uuid.parse(req.params.id), user(req)],
    );
    if (!rows[0])
      throw new DomainError(404, "NOT_FOUND", "실행 결과를 찾을 수 없어요.");
    return hydrate(c.storage, rows[0]);
  });
  app.get("/api/review-usage", async (req) => {
    const r = (
      await c.db.query(
        "SELECT * FROM review_allowances WHERE user_id=$1 AND month=$2",
        [user(req), kstMonth()],
      )
    ).rows[0];
    return {
      granted: r?.granted ?? 3,
      consumed: r?.consumed ?? 0,
      reserved: r?.reserved ?? 0,
      resetsAt: nextReset(),
      paymentEnabled: false,
    };
  });
  app.post("/api/records/:id/reviews", async (req: any) => {
    if (!c.llmEnabled)
      throw new DomainError(
        503,
        "REVIEW_UNAVAILABLE",
        "리뷰 서비스 연결이 준비되지 않았어요. 이용량은 차감되지 않습니다.",
      );
    const v = z
      .object({ requestKey: key, revision: z.number().int().nonnegative() })
      .parse(req.body);
    return c.db.tx(async (db) => {
      await db.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        user(req),
      ]);
      const r = await ownRecord(db, user(req), uuid.parse(req.params.id));
      const existing = (
        await db.query(
          "SELECT * FROM reviews WHERE user_id=$1 AND request_key=$2",
          [user(req), v.requestKey],
        )
      ).rows[0];
      if (existing) return existing;
      if (r.revision !== v.revision)
        throw new DomainError(
          409,
          "SAVE_CONFLICT",
          "최신 코드를 먼저 저장해 주세요.",
        );
      await db.query(
        "INSERT INTO review_allowances(id,user_id,month) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [id(), user(req), kstMonth()],
      );
      const a = (
        await db.query(
          "UPDATE review_allowances SET reserved=reserved+1 WHERE user_id=$1 AND month=$2 AND granted>reserved+consumed RETURNING *",
          [user(req), kstMonth()],
        )
      ).rows[0];
      if (!a)
        throw new DomainError(
          402,
          "REVIEW_LIMIT",
          "이번 달 무료 리뷰 3건을 모두 사용했어요.",
        );
      const sid = await snapshot(db, r),
        rid = id();
      await db.query(
        "INSERT INTO reviews(id,user_id,record_id,snapshot_id,allowance_id,request_key) VALUES($1,$2,$3,$4,$5,$6)",
        [rid, user(req), r.id, sid, a.id, v.requestKey],
      );
      await db.query(
        "INSERT INTO review_credit_events(id,allowance_id,review_id,request_ref,type) VALUES($1,$2,$3,$3,'RESERVE')",
        [id(), a.id, rid],
      );
      return (await db.query("SELECT * FROM reviews WHERE id=$1", [rid]))
        .rows[0];
    });
  });
  app.get("/api/records/:id/pdf", async (req: any, reply) => {
    const record = await ownRecord(c.db, user(req), uuid.parse(req.params.id));
    const problem = (
      await c.db.query("SELECT * FROM problems WHERE id=$1", [
        record.problem_id,
      ])
    ).rows[0];
    const execution = record.latest_execution_id
      ? (
          await c.db.query(
            "SELECT e.*,s.source FROM executions e JOIN code_snapshots s ON s.id=e.snapshot_id WHERE e.id=$1",
            [record.latest_execution_id],
          )
        ).rows[0]
      : null;
    const reviews = (
      await c.db.query(
        "SELECT v.*,s.source,s.language FROM reviews v JOIN code_snapshots s ON s.id=v.snapshot_id WHERE v.record_id=$1 ORDER BY v.created_at",
        [record.id],
      )
    ).rows;
    const pdf = await renderPdf({
      record,
      problem,
      execution: await hydrate(c.storage, execution),
      reviews,
    });
    return reply
      .type("application/pdf")
      .header(
        "Content-Disposition",
        `attachment; filename="algostep-${record.id}.pdf"`,
      )
      .send(pdf);
  });
  app.post("/api/internal/claim", async () =>
    c.db.tx(async (db) => {
      await db.query("SELECT id FROM execution_control WHERE id=1 FOR UPDATE");
      await db.query(
        "UPDATE executions SET status='FAILED',result=$1,finished_at=now(),lease_token=NULL WHERE status='RUNNING' AND lease_expires_at<now()",
        [
          JSON.stringify({
            systemError: "RUNNER_INTERRUPTED",
            message: "실행 환경 연결이 끊겼어요. 다시 실행해 주세요.",
          }),
        ],
      );
      const n = (
        await db.query(
          "SELECT count(*) AS n FROM executions WHERE status='RUNNING'",
        )
      ).rows[0];
      if (Number(n.n) >= 10) return { job: null };
      const e = (
        await db.query(
          "SELECT e.* FROM executions e JOIN records r ON r.id=e.record_id WHERE e.status='QUEUED' AND r.expires_at>now() ORDER BY e.created_at LIMIT 1 FOR UPDATE OF e SKIP LOCKED",
        )
      ).rows[0];
      if (!e) return { job: null };
      const token = id();
      await db.query(
        "UPDATE executions SET status='RUNNING',attempt=attempt+1,lease_token=$2,lease_expires_at=now()+interval '90 seconds' WHERE id=$1",
        [e.id, token],
      );
      const info = (
        await db.query(
          "SELECT s.language,s.source,p.tests FROM code_snapshots s JOIN records r ON r.id=s.record_id JOIN problems p ON p.id=r.problem_id WHERE s.id=$1",
          [e.snapshot_id],
        )
      ).rows[0];
      return {
        job: {
          id: e.id,
          token,
          language: info.language,
          source: info.source,
          tests:
            e.mode === "custom"
              ? [{ input: e.custom_input, expected: null }]
              : info.tests,
          limits: {
            testMs: 10000,
            memoryBytes: 536870912,
            compileMs: 30000,
            outputBytes: 65536,
            traceSteps: 2000,
            submissionMs: 120000,
          },
        },
      };
    }),
  );
  app.post("/api/internal/executions/:id/heartbeat", async (req: any) => {
    const { token } = z.object({ token: uuid }).parse(req.body);
    const r = await c.db.query(
      "UPDATE executions SET lease_expires_at=now()+interval '90 seconds' WHERE id=$1 AND lease_token=$2 AND status='RUNNING' RETURNING id",
      [uuid.parse(req.params.id), token],
    );
    return { active: !!r.rows.length };
  });
  app.post("/api/internal/executions/:id/result", async (req: any) => {
    const v = z
      .object({
        token: uuid,
        result: resultInput.optional(),
        systemError: z.string().max(100).optional(),
      })
      .refine((x) => !!x.result !== !!x.systemError)
      .parse(req.body);
    return c.db.tx(async (db) => {
      const e = (
        await db.query(
          "SELECT e.*,r.problem_id FROM executions e JOIN records r ON r.id=e.record_id WHERE e.id=$1 AND e.lease_token=$2 AND e.status='RUNNING' AND e.lease_expires_at>now() AND r.expires_at>now() FOR UPDATE OF e",
          [uuid.parse(req.params.id), v.token],
        )
      ).rows[0];
      if (!e) return { accepted: false };
      let result: any = v.result ?? { systemError: v.systemError };
      if (v.result) {
        const info = (
          await db.query(
            "SELECT s.*,p.references_code,p.complexity_time,p.complexity_space,t.complexity FROM code_snapshots s JOIN records r ON r.id=s.record_id JOIN problems p ON p.id=r.problem_id JOIN topics t ON t.id=p.topic_id WHERE s.id=$1",
            [e.snapshot_id],
          )
        ).rows[0];
        result = {
          ...v.result,
          analysis: analysis(
            info.language,
            info.source,
            info.references_code[info.language],
            info,
          ),
        };
      }
      if (c.storage && v.result)
        result = await externalize(c.storage, e.id, result);
      await db.query(
        "UPDATE executions SET status=$2,result=$3,finished_at=now(),lease_token=NULL WHERE id=$1",
        [e.id, v.systemError ? "FAILED" : "SUCCEEDED", JSON.stringify(result)],
      );
      return { accepted: true };
    });
  });
  return app;
}
