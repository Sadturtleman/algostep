import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { schema } from "./schema.js";
export interface DB {
  query(sql: string, args?: any[]): Promise<{ rows: Record<string, any>[] }>;
  tx<T>(fn: (db: DB) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export async function database(url?: string, path?: string): Promise<DB> {
  if (url) {
    const pool = new pg.Pool({ connectionString: url, max: 5 });
    const wrap = (client: pg.Pool | pg.PoolClient): DB => ({
      query: async (sql, args) => await client.query(sql, args),
      close: async () => {},
      tx: async (fn) => {
        const c = await pool.connect();
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
    await pool.query(schema);
    return db;
  }
  const lite = new PGlite(path);
  await lite.exec(schema);
  const wrap = (c: any): DB => ({
    query: async (sql, args) => c.query(sql, args),
    tx: (fn) => lite.transaction((t) => fn(wrap(t))),
    close: () => lite.close(),
  });
  return wrap(lite);
}
