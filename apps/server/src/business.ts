import type { DB } from "./db.js";
import { randomUUID } from "node:crypto";
import {
  safeEventProperties,
  type BusinessEventType,
} from "./event-catalog.js";
import { analyticsContext } from "./analytics-context.js";

// Only purpose-selected non-content metadata belongs here: never code, prompts,
// tokens, passwords, request bodies or inquiry contents.
export async function businessEvent(
  db: DB,
  type: BusinessEventType,
  actor: string | null,
  entity: string | null,
  key: string,
  metadata: Record<string, string | number | boolean> = {},
) {
  await db.query(
    `WITH inserted AS (
      INSERT INTO business_events(id,event_key,type,actor_id,entity_id,metadata,analytics_context)
      VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $7::jsonb!='{}'::jsonb THEN $7::jsonb ELSE COALESCE((SELECT analytics_context FROM business_events WHERE actor_id=$4 AND entity_id=$5 AND analytics_context!='{}'::jsonb ORDER BY created_at LIMIT 1),'{}'::jsonb) END)
      ON CONFLICT(event_key) DO NOTHING RETURNING id), ga4 AS (
      INSERT INTO analytics_deliveries(event_id) SELECT id FROM inserted RETURNING event_id)
      INSERT INTO amplitude_deliveries(event_id) SELECT event_id FROM ga4`,
    [
      randomUUID(),
      key,
      type,
      actor,
      entity,
      JSON.stringify(safeEventProperties(type, metadata)),
      JSON.stringify(analyticsContext.getStore() ?? {}),
    ],
  );
}

export async function visit(db: DB, user: string) {
  await db.query(
    `WITH v AS (
    INSERT INTO visitor_days(user_id,day) VALUES($1,(now() AT TIME ZONE 'Asia/Seoul')::date) ON CONFLICT DO NOTHING RETURNING day
  ), e AS (
    INSERT INTO business_events(id,event_key,type,actor_id,metadata,analytics_context)
    SELECT $2,'visit:' || $1 || ':' || day::text,'DAILY_VISIT',$1,'{}'::jsonb,$3::jsonb FROM v ON CONFLICT(event_key) DO NOTHING RETURNING id
  ), ga4 AS (INSERT INTO analytics_deliveries(event_id) SELECT id FROM e RETURNING event_id)
  INSERT INTO amplitude_deliveries(event_id) SELECT event_id FROM ga4`,
    [user, randomUUID(), JSON.stringify(analyticsContext.getStore() ?? {})],
  );
}
