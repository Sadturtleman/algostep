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
