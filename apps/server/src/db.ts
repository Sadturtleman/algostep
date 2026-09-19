import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { migrate } from "./migrations.js";
export interface DB {
  query(sql: string, args?: any[]): Promise<{ rows: Record<string, any>[] }>;
  tx<T>(fn: (db: DB) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export async function database(url?: string, path?: string): Promise<DB> {
  if (url) {
    const schema = process.env.DATABASE_SCHEMA;
    if (schema && !/^[a-z][a-z0-9_]{0,62}$/.test(schema))
      throw new Error("INVALID_DATABASE_SCHEMA");
    const pool = new pg.Pool({
      connectionString: url.trim(),
      max: 5,
    });
    const initialized = new WeakSet<pg.PoolClient>();
    const connect = async () => {
      const client = await pool.connect();
      try {
        // Session poolers may ignore PostgreSQL startup "options". Set the
        // schema on the actual session before any migration or application SQL.
        if (schema && !initialized.has(client)) {
          await client.query(`SET search_path TO "${schema}"`);
          initialized.add(client);
        }
        return client;
      } catch (error) {
        client.release(true);
        throw error;
      }
    };
    const wrap = (client: pg.Pool | pg.PoolClient): DB => ({
      query: async (sql, args) => {
        if (client !== pool) return client.query(sql, args);
        const c = await connect();
        try {
          return await c.query(sql, args);
        } finally {
          c.release();
        }
      },
      close: async () => {},
      tx: async (fn) => {
        const c = await connect();
        try {
          await c.query("BEGIN");
          const result = await fn(wrap(c));
          await c.query("COMMIT");
          return result;
        } catch (e) {
          await c.query("ROLLBACK");
          throw e;
        } finally {
          c.release();
        }
      },
    });
    const db = wrap(pool);
    db.close = () => pool.end();
    if (schema) await db.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await migrate(db);
    return db;
  }
  const lite = new PGlite(path);
  const wrap = (c: any): DB => ({
    query: async (sql, args) => c.query(sql, args),
    tx: (fn) => lite.transaction((t) => fn(wrap(t))),
    close: () => lite.close(),
  });
  const db = wrap(lite);
  await migrate(db);
  return db;
}
