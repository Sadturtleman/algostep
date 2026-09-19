import { resolve } from "node:path";
import { database } from "./db.js";
import { seed } from "./content.js";
import { createApp } from "./app.js";
import { cleanExpired } from "./domain.js";
import { processReview, recoverReviews } from "./review-worker.js";
import { GcsStorage } from "./object-storage.js";
import { maintenance } from "./maintenance.js";
import staticFiles from "@fastify/static";
const production = process.env.NODE_ENV === "production";
if(production && process.env.OPERATIONS_TOKEN && (process.env.OPERATIONS_TOKEN.length<32 || process.env.OPERATIONS_TOKEN.startsWith('replace-')))
  throw new Error('Use a strong OPERATIONS_TOKEN.');
if (
  production &&
  (!process.env.DATABASE_URL ||
    !process.env.WEB_ORIGIN?.startsWith("https://") ||
    !process.env.GOOGLE_CLIENT_ID ||
    [process.env.SESSION_SECRET, process.env.RUNNER_TOKEN].some(
      (v) => !v || v.length < 32 || v.startsWith("replace-"),
    ))
)
  throw new Error(
    "Production requires PostgreSQL, HTTPS, Google OAuth and strong secrets.",
  );
const db = await database(
  process.env.DATABASE_URL,
  resolve(process.env.LOCAL_DATABASE_PATH ?? "../../.data/postgres"),
);
await seed(db);
await recoverReviews(db);
await cleanExpired(db);
const llmEnabled = !!(
  process.env.LLM_API_URL &&
  process.env.LLM_API_KEY &&
  process.env.LLM_MODEL
);
const app = await createApp({
  db,
  origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  sessionSecret:
    process.env.SESSION_SECRET ?? "local-development-secret-not-for-production",
  runnerToken: process.env.RUNNER_TOKEN ?? "",
  llmEnabled,
  production,
  storage: process.env.TRACE_BUCKET
    ? new GcsStorage(process.env.TRACE_BUCKET)
    : undefined,
  operationsToken: process.env.OPERATIONS_TOKEN,
  schedulerAudience: process.env.SCHEDULER_AUDIENCE,
  schedulerEmail: process.env.SCHEDULER_EMAIL,
});
if (process.env.WEB_DIST)
  await app.register(staticFiles, {
    root: resolve(process.env.WEB_DIST),
    prefix: "/",
  });
let busy = false;
const timer = setInterval(async () => {
  if (busy) return;
  if (process.env.BACKGROUND_WORKER === "false") return;
  busy = true;
  try {
    await maintenance(
      db,
      process.env.TRACE_BUCKET
        ? new GcsStorage(process.env.TRACE_BUCKET)
        : undefined,
    );
  } catch (e) {
    app.log.error(e);
  } finally {
    busy = false;
  }
}, 2500);
await app.listen({
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? "127.0.0.1",
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, async () => {
    clearInterval(timer);
    await app.close();
    while (busy) await new Promise((r) => setTimeout(r, 100));
    await db.close();
    process.exit(0);
  });
