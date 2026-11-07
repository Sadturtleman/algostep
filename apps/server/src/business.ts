import type { DB } from "./db.js";
import { randomUUID } from "node:crypto";

// Only purpose-selected non-content metadata belongs here: never code, prompts,
// tokens, passwords, request bodies or inquiry contents.
export async function businessEvent(
  db: DB,
  type: string,
  actor: string | null,
  entity: string | null,
  key: string,
  metadata: Record<string, string | number | boolean> = {},
) {
  await db.query(
    "INSERT INTO business_events(id,event_key,type,actor_id,entity_id,metadata) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(event_key) DO NOTHING",
    [randomUUID(), key, type, actor, entity, JSON.stringify(metadata)],
  );
}

export async function visit(db: DB, user: string) {
  await db.query(
    "INSERT INTO visitor_days(user_id,day) VALUES($1,(now() AT TIME ZONE 'Asia/Seoul')::date) ON CONFLICT DO NOTHING",
    [user],
  );
}
