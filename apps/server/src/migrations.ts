import type { DB } from "./db.js";
import { schema } from "./schema.js";

// Version 1 is the original production schema. Never edit an applied migration.
const migrations = [
  { version: 1, sql: schema },
  {
    version: 2,
    sql: `
    CREATE TABLE audit_events(id bigserial PRIMARY KEY, action text NOT NULL, actor_id uuid REFERENCES users, entity_id text, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX audit_events_created ON audit_events(created_at);
    CREATE INDEX sessions_expiry ON sessions(expires_at);
    CREATE INDEX reviews_queue ON reviews(status,created_at);
    ALTER TABLE problems ADD COLUMN complexity_time text;
    ALTER TABLE problems ADD COLUMN complexity_space text;
    ALTER TABLE sessions ADD COLUMN client text NOT NULL DEFAULT 'web';
    CREATE TABLE auth_challenges(nonce_hash text PRIMARY KEY, expires_at timestamptz NOT NULL);
    CREATE TABLE object_deletions(object_key text PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now());
  `,
  },
  {
    version: 3,
    sql: `CREATE TABLE review_api_usage(id uuid PRIMARY KEY, provider text NOT NULL, model text NOT NULL, input_tokens bigint, output_tokens bigint, thinking_tokens bigint, created_at timestamptz NOT NULL DEFAULT now());
  CREATE INDEX review_api_usage_created ON review_api_usage(created_at);`,
  },
  {
    version: 4,
    sql: `ALTER TABLE executions ADD COLUMN worker_name text;
    CREATE TABLE worker_hosts(name text PRIMARY KEY,desired text NOT NULL,observed text,observed_at timestamptz,idle_since timestamptz NOT NULL DEFAULT now(),action text,action_id uuid);
    CREATE TABLE fleet_controller(id integer PRIMARY KEY CHECK(id=1),token uuid,expires_at timestamptz);
    INSERT INTO fleet_controller(id) VALUES(1);`,
  },
  {
    version: 5,
    sql: `
    CREATE TABLE visitor_days(user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,day date NOT NULL,first_seen timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,day));
    CREATE INDEX visitor_days_day ON visitor_days(day);
    CREATE TABLE business_events(id uuid PRIMARY KEY,event_key text UNIQUE NOT NULL,type text NOT NULL,actor_id uuid REFERENCES users ON DELETE SET NULL,entity_id text,metadata jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX business_events_created ON business_events(created_at DESC);
    CREATE INDEX business_events_type_created ON business_events(type,created_at);
    CREATE TABLE support_tickets(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users,request_key text NOT NULL,category text NOT NULL CHECK(category IN ('question','bug','billing','other')),subject text NOT NULL,body text NOT NULL,status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_PROGRESS','RESOLVED')),reply text NOT NULL DEFAULT '',revision integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,request_key));
    CREATE INDEX support_tickets_status ON support_tickets(status,created_at DESC);
    CREATE TABLE cost_entries(id uuid PRIMARY KEY,source_key text UNIQUE NOT NULL,usage_date date NOT NULL,service text NOT NULL,currency text NOT NULL CHECK(currency IN ('KRW','USD')),amount numeric(18,6) NOT NULL,source text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX cost_entries_date ON cost_entries(usage_date);
    CREATE TABLE revenue_entries(id uuid PRIMARY KEY,provider_event_id text UNIQUE NOT NULL,kind text NOT NULL CHECK(kind IN ('PAYMENT','REFUND')),currency text NOT NULL CHECK(currency IN ('KRW','USD')),amount numeric(18,6) NOT NULL CHECK(amount>0),occurred_at timestamptz NOT NULL);
    CREATE INDEX revenue_entries_date ON revenue_entries(occurred_at);
  `,
  },
  {
    version: 6,
    sql: `
    ALTER TABLE users ADD COLUMN analytics_id uuid NOT NULL DEFAULT gen_random_uuid();
    CREATE UNIQUE INDEX users_analytics_id ON users(analytics_id);
    ALTER TABLE business_events ADD COLUMN analytics_context jsonb NOT NULL DEFAULT '{}';
    CREATE TABLE analytics_deliveries(event_id uuid PRIMARY KEY REFERENCES business_events ON DELETE CASCADE,status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','ACCEPTED','REJECTED','UNCERTAIN','EXPIRED')),attempts integer NOT NULL DEFAULT 0,available_at timestamptz NOT NULL DEFAULT now(),lease_token uuid,lease_until timestamptz,last_code text,updated_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX analytics_deliveries_queue ON analytics_deliveries(status,available_at);
    INSERT INTO analytics_deliveries(event_id) SELECT id FROM business_events;
    CREATE VIEW analytics_events WITH (security_barrier=true) AS SELECT e.id AS event_id,e.type AS event_type,'as_' || lower(e.type) AS ga4_event_name,u.analytics_id::text AS user_id,e.created_at,e.created_at AT TIME ZONE 'Asia/Seoul' AS occurred_at_kst,e.metadata FROM business_events e LEFT JOIN users u ON u.id=e.actor_id;
    CREATE VIEW analytics_visitors WITH (security_barrier=true) AS SELECT u.analytics_id::text AS user_id,v.day AS day_kst FROM visitor_days v JOIN users u ON u.id=v.user_id;
    CREATE VIEW analytics_users WITH (security_barrier=true) AS SELECT analytics_id::text AS user_id,created_at,created_at AT TIME ZONE 'Asia/Seoul' AS registered_at_kst FROM users;
    CREATE VIEW analytics_costs WITH (security_barrier=true) AS SELECT usage_date AS day_kst,service,currency,sum(amount) AS amount FROM cost_entries GROUP BY usage_date,service,currency;
    CREATE VIEW analytics_revenue WITH (security_barrier=true) AS SELECT (occurred_at AT TIME ZONE 'Asia/Seoul')::date AS day_kst,currency,kind,sum(amount) AS amount FROM revenue_entries GROUP BY 1,2,3;
    CREATE VIEW analytics_inquiries WITH (security_barrier=true) AS SELECT (created_at AT TIME ZONE 'Asia/Seoul')::date AS day_kst,category,status,count(*) AS inquiries FROM support_tickets GROUP BY 1,2,3;
    CREATE VIEW analytics_delivery_status WITH (security_barrier=true) AS SELECT e.type AS event_type,d.status,d.last_code,count(*) AS events,min(e.created_at) AS oldest_event,max(d.updated_at) AS last_update FROM analytics_deliveries d JOIN business_events e ON e.id=d.event_id GROUP BY 1,2,3;
    REVOKE ALL ON analytics_events,analytics_visitors,analytics_users,analytics_costs,analytics_revenue,analytics_inquiries,analytics_delivery_status FROM PUBLIC;
    `,
  },
];

export async function migrate(db: DB) {
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  await db.tx(async (tx) => {
    // PostgreSQL table locks serialize concurrent starts, including the first install.
    await tx.query("LOCK TABLE schema_migrations IN EXCLUSIVE MODE");
    const applied = new Set(
      (await tx.query("SELECT version FROM schema_migrations")).rows.map(
        (r) => r.version,
      ),
    );
    for (const m of migrations)
      if (!applied.has(m.version)) {
        // pg accepts a multi-statement query; PGlite query does not. All migration
        // statements here are DDL without procedural bodies or semicolons in literals.
        for (const sql of m.sql
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean))
          await tx.query(sql);
        await tx.query(
          "INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT DO NOTHING",
          [m.version],
        );
      }
  });
}
