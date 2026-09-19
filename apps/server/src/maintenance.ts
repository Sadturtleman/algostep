import { llmOptions } from "./llm.js";
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
  const llm = llmOptions();
  if (llm) await processReview(db, llm);
}
