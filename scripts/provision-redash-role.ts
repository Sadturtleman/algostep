// Run only with the owner's existing DB connection and a password held in an
// environment variable/Secret Manager. Never prints credentials or SQL errors.
import pg from "pg";
import { readFileSync } from "node:fs";
const views = [
  "analytics_events",
  "analytics_visitors",
  "analytics_users",
  "analytics_costs",
  "analytics_revenue",
  "analytics_inquiries",
  "analytics_delivery_status",
];
const marker = "Algostep managed analytics reader v1";
const password = process.env.REDASH_DB_PASSWORD;
if (
  !process.env.DATABASE_URL ||
  !process.env.DATABASE_SSL_CA ||
  !password ||
  password.length < 32
)
  throw new Error(
    "Database URL, CA and a 32+ character REDASH_DB_PASSWORD are required",
  );
const url = new URL(process.env.DATABASE_URL);
for (const k of ["sslmode", "sslrootcert", "sslcert", "sslkey"])
  url.searchParams.delete(k);
const db = new pg.Client({
  connectionString: url.toString(),
  ssl: {
    ca: readFileSync(process.env.DATABASE_SSL_CA, "utf8"),
    rejectUnauthorized: true,
  },
});
try {
  await db.connect();
  await db.query("BEGIN");
  const existing = (
    await db.query(
      "SELECT oid,shobj_description(oid,'pg_authid') AS description FROM pg_roles WHERE rolname='algostep_redash'",
    )
  ).rows[0];
  if (existing && existing.description !== marker)
    throw new Error("UNMANAGED_ROLE_EXISTS");
  const available = (
    await db.query(
      "SELECT table_name FROM information_schema.views WHERE table_schema='algostep' AND table_name=ANY($1)",
      [views],
    )
  ).rows;
  if (available.length !== views.length)
    throw new Error("ANALYTICS_MIGRATION_REQUIRED");
  const literal = "'" + password.replaceAll("'", "''") + "'";
  if (!existing)
    await db.query(
      `CREATE ROLE algostep_redash LOGIN PASSWORD ${literal} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 3`,
    );
  else await db.query(`ALTER ROLE algostep_redash PASSWORD ${literal}`);
  await db.query(
    "COMMENT ON ROLE algostep_redash IS 'Algostep managed analytics reader v1'",
  );
  await db.query(
    "ALTER ROLE algostep_redash SET search_path TO pg_catalog,algostep",
  );
  await db.query(
    "ALTER ROLE algostep_redash SET default_transaction_read_only TO on",
  );
  await db.query("ALTER ROLE algostep_redash SET statement_timeout TO '15s'");
  await db.query("GRANT USAGE ON SCHEMA algostep TO algostep_redash");
  for (const view of views)
    await db.query(`GRANT SELECT ON algostep.${view} TO algostep_redash`);
  const unsafe = (
    await db.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='algostep' AND (has_table_privilege('algostep_redash',quote_ident(schemaname)||'.'||quote_ident(tablename),'SELECT') OR has_table_privilege('algostep_redash',quote_ident(schemaname)||'.'||quote_ident(tablename),'INSERT,UPDATE,DELETE'))",
    )
  ).rows;
  const memberships = (
    await db.query(
      "SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='algostep_redash')",
    )
  ).rows;
  if (unsafe.length || memberships.length)
    throw new Error("READER_HAS_UNEXPECTED_PRIVILEGES");
  await db.query("COMMIT");
  console.log(
    "Read-only analytics role provisioned; base-table access denied. No credentials printed.",
  );
} catch {
  await db.query("ROLLBACK").catch(() => {});
  console.error(
    "Redash reader provisioning failed; changes rolled back. Check owner permissions, migration and managed-role ownership.",
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
