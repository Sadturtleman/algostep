import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { DB } from "./db.js";
import { DomainError, id } from "./domain.js";
import { businessEvent, visit } from "./business.js";

export const kstDate = (at = new Date()) =>
  new Date(at.getTime() + 9 * 3600000).toISOString().slice(0, 10);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      Number.isFinite(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
  );
const paging = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
const ticketStatus = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]);
const costInput = z
  .object({
    sourceKey: z.string().trim().min(1).max(180),
    usageDate: date,
    service: z.string().trim().min(1).max(100),
    currency: z.enum(["KRW", "USD"]),
    amount: z.number().finite().min(-1e9).max(1e9),
    source: z.string().trim().min(1).max(200),
  })
  .strict();
export function reportRange(query: unknown, now = new Date()) {
  const today = kstDate(now);
  const v = z
    .object({
      from: date.default(today.slice(0, 7) + "-01"),
      to: date.default(today),
      grain: z.enum(["day", "week", "month"]).default("day"),
    })
    .parse(query);
  if (
    v.from > v.to ||
    v.to > today ||
    (Date.parse(v.to) - Date.parse(v.from)) / 86400000 > 365
  )
    throw new DomainError(
      400,
      "INVALID_RANGE",
      "조회 기간은 오늘까지, 최대 366일로 선택해 주세요.",
    );
  return v;
}

export async function registerAdmin(app: FastifyInstance, db: DB) {
  // Authentication, role checks and CSRF are enforced by the application's
  // preHandler for every /api/admin route, including routes added in the future.
  app.post("/api/analytics/visit", async (req: any) => {
    await visit(db, req.user.id);
    return { ok: true };
  });
  app.get("/api/admin/dashboard", async (req) => {
    const range = reportRange(req.query);
    const args = [range.from, range.to];
    return db.tx(async (tx) => {
      // One coherent snapshot for cards, charts and their tabular equivalents.
      await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      const counts = (
        await tx.query(
          `WITH clock AS (SELECT (now() AT TIME ZONE 'Asia/Seoul')::date AS today)
        SELECT (SELECT count(DISTINCT user_id)::int FROM visitor_days) AS cumulative,
        (SELECT count(DISTINCT user_id)::int FROM visitor_days,clock WHERE day=today) AS daily,
        (SELECT count(DISTINCT user_id)::int FROM visitor_days,clock WHERE day>=date_trunc('week',today)::date AND day<=today) AS weekly,
        (SELECT count(DISTINCT user_id)::int FROM visitor_days,clock WHERE day>=date_trunc('month',today)::date AND day<=today) AS monthly,
        (SELECT count(*)::int FROM users) AS users,
        (SELECT count(*)::int FROM users WHERE created_at >= $1::date::timestamp AT TIME ZONE 'Asia/Seoul' AND created_at < ($2::date+1)::timestamp AT TIME ZONE 'Asia/Seoul') AS new_users,
        (SELECT count(DISTINCT user_id)::int FROM visitor_days WHERE day BETWEEN $1::date AND $2::date) AS period_visitors,
        (SELECT count(*)::int FROM support_tickets WHERE status!='RESOLVED') AS open_inquiries,
        (SELECT min(first_seen) FROM visitor_days) AS tracking_since`,
          args,
        )
      ).rows[0];
      const series = (
        await tx.query(
          `WITH buckets AS (
        SELECT generate_series(date_trunc($3,$1::date),date_trunc($3,$2::date),('1 ' || $3)::interval)::date AS bucket
      ), visitors AS (
        SELECT date_trunc($3,day)::date AS bucket,count(DISTINCT user_id)::int AS visitors FROM visitor_days WHERE day BETWEEN $1::date AND $2::date GROUP BY 1
      ), joined AS (
        SELECT date_trunc($3,created_at AT TIME ZONE 'Asia/Seoul')::date AS bucket,count(*)::int AS new_users FROM users
        WHERE created_at >= $1::date::timestamp AT TIME ZONE 'Asia/Seoul' AND created_at < ($2::date+1)::timestamp AT TIME ZONE 'Asia/Seoul' GROUP BY 1
      ) SELECT to_char(b.bucket,'YYYY-MM-DD') AS period,CASE WHEN (SELECT min(day) FROM visitor_days) IS NULL OR (b.bucket+('1 ' || $3)::interval)::date <= (SELECT min(day) FROM visitor_days) THEN NULL ELSE coalesce(v.visitors,0)::int END AS visitors,coalesce(j.new_users,0)::int AS new_users
      FROM buckets b LEFT JOIN visitors v USING(bucket) LEFT JOIN joined j USING(bucket) ORDER BY b.bucket`,
          [...args, range.grain],
        )
      ).rows;
      const costs = (
        await tx.query(
          `SELECT currency,sum(amount)::text AS amount,count(*)::int AS entries,max(updated_at) AS updated_at FROM cost_entries WHERE usage_date BETWEEN $1::date AND $2::date GROUP BY currency`,
          args,
        )
      ).rows;
      const revenue = (
        await tx.query(
          `SELECT currency,sum(CASE WHEN kind='PAYMENT' THEN amount ELSE 0 END)::text AS gross,sum(CASE WHEN kind='REFUND' THEN amount ELSE 0 END)::text AS refunds,sum(CASE WHEN kind='PAYMENT' THEN amount ELSE -amount END)::text AS net FROM revenue_entries WHERE occurred_at >= $1::date::timestamp AT TIME ZONE 'Asia/Seoul' AND occurred_at < ($2::date+1)::timestamp AT TIME ZONE 'Asia/Seoul' GROUP BY currency`,
          args,
        )
      ).rows;
      const costSeries = (
        await tx.query(
          `SELECT to_char(date_trunc($3,usage_date),'YYYY-MM-DD') AS period,currency,sum(amount)::text AS amount FROM cost_entries WHERE usage_date BETWEEN $1::date AND $2::date GROUP BY 1,2 ORDER BY 1,2`,
          [...args, range.grain],
        )
      ).rows;
      const revenueSeries = (
        await tx.query(
          `SELECT to_char(date_trunc($3,occurred_at AT TIME ZONE 'Asia/Seoul'),'YYYY-MM-DD') AS period,currency,sum(CASE WHEN kind='PAYMENT' THEN amount ELSE -amount END)::text AS amount FROM revenue_entries WHERE occurred_at >= $1::date::timestamp AT TIME ZONE 'Asia/Seoul' AND occurred_at < ($2::date+1)::timestamp AT TIME ZONE 'Asia/Seoul' GROUP BY 1,2 ORDER BY 1,2`,
          [...args, range.grain],
        )
      ).rows;
      const usage = (
        await tx.query(
          `SELECT provider,model,count(*)::int AS calls,count(input_tokens)::int AS measured_calls,sum(input_tokens)::text AS input_tokens,sum(output_tokens)::text AS output_tokens,sum(thinking_tokens)::text AS thinking_tokens FROM review_api_usage WHERE created_at >= $1::date::timestamp AT TIME ZONE 'Asia/Seoul' AND created_at < ($2::date+1)::timestamp AT TIME ZONE 'Asia/Seoul' GROUP BY provider,model`,
          args,
        )
      ).rows;
      const events = (
        await tx.query(
          `SELECT type,count(*)::int AS count FROM business_events WHERE created_at >= $1::date::timestamp AT TIME ZONE 'Asia/Seoul' AND created_at < ($2::date+1)::timestamp AT TIME ZONE 'Asia/Seoul' GROUP BY type ORDER BY count DESC`,
          args,
        )
      ).rows;
      return {
        range,
        timezone: "Asia/Seoul",
        counts,
        series,
        costs,
        costSeries,
        revenue,
        revenueSeries,
        usage,
        events,
        paymentEnabled: false,
        costSource: "imported_actuals",
        generatedAt: new Date().toISOString(),
      };
    });
  });
  app.get("/api/admin/users", async (req) => {
    const { page } = paging.parse(req.query);
    const rows = (
      await db.query(
        `SELECT u.id,u.email,u.display_name,u.created_at,(SELECT max(day)::text FROM visitor_days v WHERE v.user_id=u.id) AS last_visit FROM users u ORDER BY u.created_at DESC,u.id LIMIT 26 OFFSET $1`,
        [(page - 1) * 25],
      )
    ).rows;
    return { rows: rows.slice(0, 25), hasMore: rows.length > 25 };
  });
  app.get("/api/admin/events", async (req) => {
    const { page } = paging.parse(req.query);
    const range = reportRange(req.query);
    const { type } = z
      .object({
        type: z
          .string()
          .regex(/^[A-Z_]{1,60}$/)
          .optional(),
      })
      .parse(req.query);
    const rows = (
      await db.query(
        `SELECT id,type,actor_id,entity_id,metadata,created_at FROM business_events WHERE created_at >= $1::date::timestamp AT TIME ZONE 'Asia/Seoul' AND created_at < ($2::date+1)::timestamp AT TIME ZONE 'Asia/Seoul' AND ($3::text IS NULL OR type=$3) ORDER BY created_at DESC,id LIMIT 51 OFFSET $4`,
        [range.from, range.to, type ?? null, (page - 1) * 50],
      )
    ).rows;
    return { rows: rows.slice(0, 50), hasMore: rows.length > 50 };
  });
  const listTickets = async (req: any, admin: boolean) => {
    const { page } = paging.parse(req.query);
    const { status } = z
      .object({ status: ticketStatus.optional() })
      .parse(req.query);
    const rows = (
      await db.query(
        `SELECT t.*,${admin ? "u.email,u.display_name," : ""}count(*) OVER()::int AS total FROM support_tickets t JOIN users u ON u.id=t.user_id WHERE ($1::uuid IS NULL OR t.user_id=$1) AND ($2::text IS NULL OR t.status=$2) ORDER BY t.created_at DESC,t.id LIMIT 26 OFFSET $3`,
        [admin ? null : req.user.id, status ?? null, (page - 1) * 25],
      )
    ).rows;
    return { rows: rows.slice(0, 25), hasMore: rows.length > 25 };
  };
  app.get("/api/support", (req) => listTickets(req, false));
  app.get("/api/admin/inquiries", (req) => listTickets(req, true));
  app.post("/api/support", async (req: any) => {
    const v = z
      .object({
        requestKey: z.string().min(8).max(100),
        category: z.enum(["question", "bug", "billing", "other"]),
        subject: z.string().trim().min(1).max(120),
        body: z.string().trim().min(1).max(5000),
      })
      .strict()
      .parse(req.body);
    return db.tx(async (tx) => {
      await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        req.user.id,
      ]);
      const old = (
        await tx.query(
          "SELECT * FROM support_tickets WHERE user_id=$1 AND request_key=$2",
          [req.user.id, v.requestKey],
        )
      ).rows[0];
      if (old) return old;
      const count = (
        await tx.query(
          "SELECT count(*)::int AS n FROM support_tickets WHERE user_id=$1 AND created_at>now()-interval '24 hours'",
          [req.user.id],
        )
      ).rows[0].n;
      if (count >= 10)
        throw new DomainError(
          429,
          "INQUIRY_LIMIT",
          "문의는 24시간 동안 최대 10건까지 접수할 수 있어요.",
        );
      const ticket = (
        await tx.query(
          "INSERT INTO support_tickets(id,user_id,request_key,category,subject,body) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
          [id(), req.user.id, v.requestKey, v.category, v.subject, v.body],
        )
      ).rows[0];
      await businessEvent(
        tx,
        "INQUIRY_CREATED",
        req.user.id,
        ticket.id,
        "inquiry:" + ticket.id,
        { category: v.category },
      );
      return ticket;
    });
  });
  app.patch("/api/admin/inquiries/:id", async (req: any) => {
    const ticketId = z.string().uuid().parse(req.params.id);
    const v = z
      .object({
        status: ticketStatus,
        reply: z.string().trim().max(5000),
        revision: z.number().int().nonnegative(),
      })
      .strict()
      .parse(req.body);
    if (v.status === "RESOLVED" && !v.reply)
      throw new DomainError(
        400,
        "REPLY_REQUIRED",
        "답변을 작성한 뒤 완료 처리해 주세요.",
      );
    return db.tx(async (tx) => {
      const ticket = (
        await tx.query(
          "UPDATE support_tickets SET status=$2,reply=$3,revision=revision+1,updated_at=now() WHERE id=$1 AND revision=$4 RETURNING *",
          [ticketId, v.status, v.reply, v.revision],
        )
      ).rows[0];
      if (!ticket)
        throw new DomainError(
          409,
          "INQUIRY_CONFLICT",
          "문의가 변경됐어요. 목록을 새로고침해 주세요.",
        );
      await businessEvent(
        tx,
        "INQUIRY_UPDATED",
        req.user.id,
        ticketId,
        `inquiry:${ticketId}:${ticket.revision}`,
        { status: v.status },
      );
      return ticket;
    });
  });
  app.get("/api/admin/costs", async (req) => {
    const range = reportRange(req.query);
    const { page } = paging.parse(req.query);
    const rows = (
      await db.query(
        `SELECT id,source_key,to_char(usage_date,'YYYY-MM-DD') AS usage_date,service,currency,amount,source,updated_at FROM cost_entries WHERE usage_date BETWEEN $1::date AND $2::date ORDER BY cost_entries.usage_date DESC,source_key LIMIT 51 OFFSET $3`,
        [range.from, range.to, (page - 1) * 50],
      )
    ).rows;
    return { rows: rows.slice(0, 50), hasMore: rows.length > 50 };
  });
  const importCosts = async (req: any) => {
    const { entries } = z
      .object({ entries: z.array(costInput).min(1).max(500) })
      .strict()
      .parse(req.body);
    if (
      entries.some(
        (e) =>
          e.sourceKey.startsWith("REPLACE_") ||
          e.service.startsWith("REPLACE_") ||
          e.source.startsWith("REPLACE_") ||
          e.usageDate > kstDate(),
      )
    )
      throw new DomainError(
        400,
        "INVALID_COST_SOURCE",
        "예제 값을 실제 청구 자료로 바꾸고 사용일을 확인해 주세요. 미래 비용은 등록할 수 없어요.",
      );
    if (new Set(entries.map((e) => e.sourceKey)).size !== entries.length)
      throw new DomainError(
        400,
        "DUPLICATE_SOURCE",
        "한 가져오기에 중복된 원본 키가 있어요.",
      );
    await db.tx(async (tx) => {
      for (const e of entries) {
        await tx.query(
          `INSERT INTO cost_entries(id,source_key,usage_date,service,currency,amount,source) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(source_key) DO UPDATE SET usage_date=excluded.usage_date,service=excluded.service,currency=excluded.currency,amount=excluded.amount,source=excluded.source,updated_at=now()`,
          [
            id(),
            e.sourceKey,
            e.usageDate,
            e.service,
            e.currency,
            e.amount,
            e.source,
          ],
        );
      }
      await businessEvent(
        tx,
        "COSTS_IMPORTED",
        req.user?.id ?? null,
        null,
        "cost-import:" + id(),
        { entries: entries.length },
      );
    });
    return { imported: entries.length };
  };
  app.post("/api/admin/costs/import", importCosts);
  app.post("/api/operations/costs/import", importCosts);
}
