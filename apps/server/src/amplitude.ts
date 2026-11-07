import { randomUUID } from "node:crypto";
import type { DB } from "./db.js";
import {
  eventProperties,
  ga4EventName,
  safeEventProperties,
  type BusinessEventType,
} from "./event-catalog.js";
export type AmplitudeConfig = { apiKey: string; region: "US" | "EU" };
export function amplitudeConfig(
  env = process.env,
): AmplitudeConfig | undefined {
  if (!env.AMPLITUDE_API_KEY) return undefined;
  const region = env.AMPLITUDE_REGION || "US";
  if (
    !/^[a-zA-Z0-9_-]{16,256}$/.test(env.AMPLITUDE_API_KEY) ||
    !["US", "EU"].includes(region)
  )
    throw Error("INVALID_AMPLITUDE_CONFIGURATION");
  return { apiKey: env.AMPLITUDE_API_KEY, region: region as "US" | "EU" };
}
export function amplitudeEvent(row: Record<string, any>) {
  if (!Object.hasOwn(eventProperties, row.type))
    throw Error("UNKNOWN_EVENT_TYPE");
  const context = row.analytics_context ?? {};
  return {
    event_type: ga4EventName(row.type),
    insert_id: row.id,
    // Stable per-account fallback; do not leak Google IDs, email or DB row IDs.
    device_id:
      context.clientId ?? "server." + (row.analytics_id ?? "algostep-system"),
    ...(row.analytics_id ? { user_id: row.analytics_id } : {}),
    time: new Date(row.created_at).getTime(),
    session_id:
      context.clientId &&
      Number.isSafeInteger(context.sessionId) &&
      context.sessionId > 0
        ? context.sessionId * 1000
        : -1,
    event_properties: {
      ...safeEventProperties(row.type as BusinessEventType, row.metadata),
      event_source: context.clientId ? "web_context" : "server_unattributed",
    },
    // No IP, device fingerprint, raw URLs, user properties or session replay.
  };
}
export async function deliverAmplitude(
  db: DB,
  config = amplitudeConfig(),
  send: typeof fetch = fetch,
  limit = 250,
) {
  if (!config) return { configured: false, processed: 0 };
  await db.query(
    "UPDATE amplitude_deliveries SET status='PENDING',lease_token=NULL,lease_until=NULL,last_code='LEASE_RECOVERED',updated_at=now() WHERE status='PROCESSING' AND lease_until<now()",
  );
  // Provider deduplication is seven days. Stop before that window closes;
  // expired payloads stay visible to operators instead of risking duplicates.
  await db.query(
    "UPDATE amplitude_deliveries SET status='EXPIRED',last_code='RETRY_WINDOW_EXPIRED',updated_at=now() WHERE status='PENDING' AND first_attempt_at<now()-interval '6 days'",
  );
  let processed = 0;
  const started = Date.now();
  while (processed < limit && Date.now() - started < 20000) {
    const token = randomUUID();
    const rows = await db.tx(async (tx) => {
      const rows = (
        await tx.query(
          "SELECT e.*,u.analytics_id::text AS analytics_id,d.payload,d.attempts FROM amplitude_deliveries d JOIN business_events e ON e.id=d.event_id LEFT JOIN users u ON u.id=e.actor_id WHERE d.status='PENDING' AND d.available_at<=now() ORDER BY d.available_at,d.event_id LIMIT $1 FOR UPDATE OF d SKIP LOCKED",
          [Math.min(10, limit - processed)],
        )
      ).rows;
      const valid: Record<string, any>[] = [];
      for (const row of rows) {
        try {
          const payload = row.payload ?? amplitudeEvent(row);
          await tx.query(
            "UPDATE amplitude_deliveries SET status='PROCESSING',attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,now()),payload=$2,lease_token=$3,lease_until=now()+interval '90 seconds',updated_at=now() WHERE event_id=$1",
            [row.id, JSON.stringify(payload), token],
          );
          valid.push({ ...row, payload, attempts: row.attempts + 1 });
        } catch (error) {
          // Only schema validation is handled here; DB failure rolls back.
          if (
            (error as any).name !== "ZodError" &&
            (error as Error).message !== "UNKNOWN_EVENT_TYPE"
          )
            throw error;
          await tx.query(
            "UPDATE amplitude_deliveries SET status='REJECTED',last_code='INVALID_PAYLOAD',updated_at=now() WHERE event_id=$1",
            [row.id],
          );
        }
      }
      return { valid, claimed: rows.length };
    });
    if (!rows.claimed) break;
    processed += rows.claimed;
    if (!rows.valid.length) continue;
    let status = "PENDING",
      code = "TRANSPORT_ERROR";
    let delay = Math.min(
      3600,
      60 * 2 ** Math.min(6, Math.max(...rows.valid.map((r) => r.attempts))),
    );
    try {
      const response = await send(
        config.region === "EU"
          ? "https://api.eu.amplitude.com/2/httpapi"
          : "https://api2.amplitude.com/2/httpapi",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: config.apiKey,
            events: rows.valid.map((r) => r.payload),
          }),
          redirect: "error",
          signal: AbortSignal.timeout(5000),
        },
      );
      if (response.status === 200) {
        const body = (await response.json()) as any;
        if (
          body.code === 200 &&
          Number.isInteger(body.events_ingested) &&
          body.events_ingested >= 0 &&
          body.events_ingested <= rows.valid.length
        ) {
          status = "INGESTED";
          code =
            body.events_ingested === rows.valid.length
              ? "INGESTED"
              : "INGESTED_OR_DEDUPLICATED";
          delay = 0;
        } else code = "INGESTION_UNCONFIRMED";
      } else if (response.status === 429 || response.status >= 500)
        code = "HTTP_" + response.status;
      else {
        status = "REJECTED";
        code = "HTTP_" + response.status;
        delay = 0;
      }
    } catch {
      /* Never log provider errors, payloads or credentials. */
    }
    await db.query(
      "UPDATE amplitude_deliveries SET status=$3,last_code=$4,available_at=now()+$5*interval '1 second',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE event_id=ANY($1::uuid[]) AND lease_token=$2",
      [rows.valid.map((r) => r.id), token, status, code, delay],
    );
  }
  return { configured: true, processed };
}
export async function amplitudeStatus(db: DB) {
  const config = amplitudeConfig();
  let url: string | null = null;
  try {
    const u = new URL(process.env.AMPLITUDE_PROJECT_URL ?? "");
    if (
      u.protocol === "https:" &&
      [
        "app.amplitude.com",
        "analytics.amplitude.com",
        "app.eu.amplitude.com",
        "analytics.eu.amplitude.com",
      ].includes(u.hostname) &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash
    )
      url = u.href;
  } catch {}
  return {
    configured: !!config,
    region: config?.region ?? null,
    url,
    states: (
      await db.query(
        "SELECT status,last_code,count(*)::int AS count,min(available_at) AS oldest FROM amplitude_deliveries GROUP BY status,last_code ORDER BY status",
      )
    ).rows,
  };
}
