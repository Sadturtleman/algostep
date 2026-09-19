import { test } from "node:test";
import assert from "node:assert/strict";
import { database } from "../src/db.js";
test(
  "PostgreSQL private schema is selected on every pooled session",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const previous = process.env.DATABASE_SCHEMA;
    process.env.DATABASE_SCHEMA = "algostep_schema_test";
    const db = await database(process.env.TEST_DATABASE_URL);
    try {
      const sessions = await Promise.all(
        Array.from({ length: 10 }, () =>
          db.tx(async (c) => {
            const row = (
              await c.query("SELECT current_schema() AS schema,pg_sleep(0.03)")
            ).rows[0];
            assert.equal(row.schema, "algostep_schema_test");
            return (
              await c.query(
                "SELECT schemaname FROM pg_tables WHERE tablename='worker_hosts' AND schemaname=current_schema()",
              )
            ).rows[0];
          }),
        ),
      );
      assert.ok(sessions.every((r) => r.schemaname === "algostep_schema_test"));
    } finally {
      await db.close();
      if (previous === undefined) delete process.env.DATABASE_SCHEMA;
      else process.env.DATABASE_SCHEMA = previous;
    }
  },
);
