import type { DB } from "./db.js";

export type ProductMode = "mvp" | "full";
export function productMode(value = process.env.PRODUCT_MODE): ProductMode {
  if (value === undefined || value === "mvp") return "mvp";
  if (value === "full") return "full";
  throw new Error("PRODUCT_MODE must be mvp or full");
}

export const mvpTopics = [
  "array",
  "stack",
  "queue",
  "binary-search",
  "bubble-sort",
  "tree",
  "bfs",
  "dfs",
] as const;
export const isMvpTopic = (id: string) =>
  (mvpTopics as readonly string[]).includes(id);
export const executionLimits = {
  testMs: 10000,
  memoryBytes: 536870912,
  compileMs: 30000,
  outputBytes: 65536,
  traceSteps: 2000,
  submissionMs: 120000,
};

/** Preserve the database and transaction interface while disabling event collection. */
export function productDatabase(db: DB, mode: ProductMode): DB {
  if (mode === "full") return db;
  return {
    businessEventsEnabled: false,
    query: (sql, args) => db.query(sql, args),
    tx: (fn) => db.tx((tx) => fn(productDatabase(tx, mode))),
    close: () => db.close(),
  };
}

export function excludedMvpPath(path: string) {
  return (
    /^\/api\/(admin|support|analytics)(\/|$)/.test(path) ||
    path === "/api/review-usage" ||
    path === "/api/auth/challenge" ||
    path === "/api/operations/costs/import" ||
    /^\/api\/records\/[^/]+\/(reviews|pdf)(\/|$)/.test(path)
  );
}
