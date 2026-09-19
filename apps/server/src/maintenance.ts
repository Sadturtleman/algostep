import type { DB } from "./db.js";
import { cleanExpired } from "./domain.js";
import { processReview, recoverReviews } from "./review-worker.js";
import { deleteObjects, type ObjectStorage } from "./object-storage.js";
export async function maintenance(db: DB, storage?: ObjectStorage) {
  await cleanExpired(db);
  await recoverReviews(db);
  await deleteObjects(db, storage);
  await db.query("DELETE FROM sessions WHERE expires_at<=now()");
  await db.query("DELETE FROM auth_challenges WHERE expires_at<=now()");
  if (
    process.env.LLM_API_URL &&
    process.env.LLM_API_KEY &&
    process.env.LLM_MODEL
  )
    await processReview(db, {
      url: process.env.LLM_API_URL,
      key: process.env.LLM_API_KEY,
      model: process.env.LLM_MODEL,
    });
}
