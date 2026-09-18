import { resolve } from "node:path";
import { database } from "./db.js";
import { seed } from "./content.js";
import { createApp } from "./app.js";
import { cleanExpired } from "./domain.js";
import { processReview, recoverReviews } from "./review-worker.js";
const production = process.env.NODE_ENV === "production";
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
});
let busy = false;
const timer = setInterval(async () => {
  if (busy) return;
  busy = true;
  try {
    await cleanExpired(db);
    await recoverReviews(db);
    await db.query("DELETE FROM sessions WHERE expires_at<=now()");
    if (llmEnabled)
      await processReview(db, {
        url: process.env.LLM_API_URL!,
        key: process.env.LLM_API_KEY!,
        model: process.env.LLM_MODEL!,
      });
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
