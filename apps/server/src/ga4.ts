import type { DB } from "./db.js";
import { randomUUID } from "node:crypto";
import {
  eventProperties,
  ga4EventName,
  safeEventProperties,
  type BusinessEventType,
} from "./event-catalog.js";

export type Ga4Config = { measurementId: string; apiSecret: string };
export function ga4Config(env = process.env): Ga4Config | undefined {
  if (!env.GA4_MEASUREMENT_ID || !env.GA4_API_SECRET) return undefined;
  if (
    !/^G-[A-Z0-9]{4,20}$/.test(env.GA4_MEASUREMENT_ID) ||
    env.GA4_API_SECRET.length > 256 ||
    /\s/.test(env.GA4_API_SECRET)
  )
    throw new Error("INVALID_GA4_CONFIGURATION");
  return {
    measurementId: env.GA4_MEASUREMENT_ID,
    apiSecret: env.GA4_API_SECRET,
  };
}
export function ga4Payload(row: Record<string, any>) {
  if (!Object.hasOwn(eventProperties, row.type))
    throw new Error("UNKNOWN_EVENT_TYPE");
  const properties = safeEventProperties(
    row.type as BusinessEventType,
    row.metadata,
  );
  const context = row.analytics_context ?? {};
  const params: Record<string, string | number> = {
    event_id: row.id,
    event_source: context.clientId ? "web_context" : "server_unattributed",
  };
  for (const [key, value] of Object.entries(properties))
    params[key] = typeof value === "boolean" ? (value ? 1 : 0) : value;
  if (
    context.clientId &&
    Number.isSafeInteger(context.sessionId) &&
    context.sessionId > 0
  )
    params.session_id = context.sessionId;
  return {
    client_id:
      context.clientId ?? "server." + (row.analytics_id ?? "algostep-system"),
    ...(row.analytics_id ? { user_id: row.analytics_id } : {}),
    timestamp_micros: new Date(row.created_at).getTime() * 1000,
    consent: { ad_user_data: "DENIED", ad_personalization: "DENIED" },
    validation_behavior: "ENFORCE_RECOMMENDATIONS",
    events: [
      {
        name: ga4EventName(row.type),
        timestamp_micros: new Date(row.created_at).getTime() * 1000,
        params,
      },
    ],
  };
}

// A 2xx collect response means accepted at the HTTP layer, not proven ingestion.
// Google provides no general idempotency contract: ambiguous collect responses
// are quarantined, never automatically resent. Redash reads the exact DB ledger.
export async function deliverGa4(
  db: DB,
  config = ga4Config(),
  send: typeof fetch = fetch,
  limit = 250,
) {
  if (!config) return { configured: false, processed: 0 };
  const started = Date.now();
  let processed = 0;
  await db.query(
    "UPDATE analytics_deliveries SET status='UNCERTAIN',last_code='LEASE_EXPIRED',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE status='PROCESSING' AND lease_until<now()",
  );
  await db.query(
    "UPDATE analytics_deliveries d SET status='EXPIRED',last_code='OUTSIDE_72_HOURS',updated_at=now() FROM business_events e WHERE d.event_id=e.id AND d.status='PENDING' AND e.created_at<now()-interval '72 hours'",
  );
  while (processed < limit && Date.now() - started < 20000) {
    const token = randomUUID();
    const rows = await db.tx(async (tx) => {
      const next = (
        await tx.query(
          "SELECT d.event_id,e.actor_id,e.analytics_context FROM analytics_deliveries d JOIN business_events e ON e.id=d.event_id WHERE d.status='PENDING' AND d.available_at<=now() ORDER BY d.available_at,d.event_id LIMIT 1 FOR UPDATE OF d SKIP LOCKED",
        )
      ).rows[0];
      if (!next) return [];
      // One request has one client/user context. Preserve each event's original
      // timestamp when batching up to the provider's 25-event limit.
      const batch = (
        await tx.query(
          "SELECT d.event_id FROM analytics_deliveries d JOIN business_events e ON e.id=d.event_id WHERE d.status='PENDING' AND d.available_at<=now() AND e.actor_id IS NOT DISTINCT FROM $1::uuid AND e.analytics_context=$2::jsonb ORDER BY d.available_at,d.event_id LIMIT $3 FOR UPDATE OF d SKIP LOCKED",
          [
            next.actor_id,
            JSON.stringify(next.analytics_context),
            Math.min(25, limit - processed),
          ],
        )
      ).rows;
      const ids = batch.map((r) => r.event_id);
      await tx.query(
        "UPDATE analytics_deliveries SET status='PROCESSING',lease_token=$2,lease_until=now()+interval '90 seconds',attempts=attempts+1,updated_at=now() WHERE event_id=ANY($1::uuid[])",
        [ids, token],
      );
      return (
        await tx.query(
          "SELECT e.*,u.analytics_id::text AS analytics_id,d.attempts FROM business_events e LEFT JOIN users u ON u.id=e.actor_id JOIN analytics_deliveries d ON d.event_id=e.id WHERE e.id=ANY($1::uuid[])",
          [ids],
        )
      ).rows;
    });
    if (!rows.length) break;
    processed += rows.length;
    let status = "REJECTED",
      code = "INVALID_PAYLOAD",
      collectStarted = false,
      validationStarted = false,
      delay = 0;
    try {
      const payload = ga4Payload(rows[0]);
      payload.events = rows.flatMap((row) => ga4Payload(row).events);
      const query = new URLSearchParams({
        measurement_id: config.measurementId,
        api_secret: config.apiSecret,
      });
      const options = {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        redirect: "error" as const,
      };
      validationStarted = true;
      const checked = await send(
        "https://www.google-analytics.com/debug/mp/collect?" + query,
        { ...options, signal: AbortSignal.timeout(5000) },
      );
      if (!checked.ok) {
        code = "VALIDATION_HTTP_" + checked.status;
      } else {
        const result = (await checked.json()) as any;
        if (!Array.isArray(result.validationMessages)) {
          code = "INVALID_VALIDATION_RESPONSE";
        } else if (result.validationMessages.length) {
          code = "VALIDATION_REJECTED";
        } else {
          collectStarted = true;
          const response = await send(
            "https://www.google-analytics.com/mp/collect?" + query,
            { ...options, signal: AbortSignal.timeout(5000) },
          );
          status = response.ok ? "ACCEPTED" : "REJECTED";
          code = response.ok
            ? "HTTP_ACCEPTED"
            : "COLLECT_HTTP_" + response.status;
        }
      }
    } catch {
      // Never log provider exceptions: their message may contain the secret URL.
      if (collectStarted) {
        status = "UNCERTAIN";
        code = "COLLECT_RESPONSE_UNKNOWN";
      } else if (
        validationStarted &&
        Math.max(...rows.map((r) => r.attempts)) < 5
      ) {
        status = "PENDING";
        code = "VALIDATION_UNAVAILABLE";
        delay = Math.min(
          3600,
          60 * 2 ** Math.max(...rows.map((r) => r.attempts)),
        );
      } else if (validationStarted) {
        status = "REJECTED";
        code = "VALIDATION_RETRY_EXHAUSTED";
      }
    }
    await db.query(
      "UPDATE analytics_deliveries SET status=$3,last_code=$4,available_at=now()+$5*interval '1 second',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE event_id=ANY($1::uuid[]) AND lease_token=$2",
      [rows.map((r) => r.id), token, status, code, delay],
    );
  }
  return { configured: true, processed };
}

export async function analyticsStatus(db: DB) {
  const config = ga4Config();
  let redashUrl: string | null = null;
  try {
    const u = new URL(process.env.REDASH_URL ?? "");
    if (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash
    )
      redashUrl = u.href;
  } catch {}
  return {
    ga4: {
      configured: !!config,
      measurementId: config?.measurementId ?? null,
      states: (
        await db.query(
          "SELECT status,last_code,count(*)::int AS count,min(available_at) AS oldest FROM analytics_deliveries GROUP BY status,last_code ORDER BY status",
        )
      ).rows,
    },
    redash: { url: redashUrl, source: "read-only PostgreSQL analytics views" },
    catalog: Object.entries(eventProperties).map(([type]) => ({
      type,
      ga4Name: ga4EventName(type),
    })),
  };
}
