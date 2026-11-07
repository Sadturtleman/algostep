import { z } from "zod";
import { requestReview, type LlmOptions } from "./llm.js";
import type { DB } from "./db.js";
import { id, releaseReview } from "./domain.js";
import { businessEvent } from "./business.js";
const resultSchema = z.object({
  logicalErrors: z.string().min(1).max(15000),
  efficiencyImprovements: z.string().min(1).max(15000),
  alternativeCode: z.string().min(1).max(65536),
});
export async function processReview(db: DB, options: LlmOptions) {
  const task = await db.tx(async (tx) => {
    const r = (
      await tx.query(
        "SELECT * FROM reviews WHERE status='QUEUED' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED",
      )
    ).rows[0];
    if (!r) return null;
    await tx.query(
      "UPDATE reviews SET status='RUNNING',started_at=now() WHERE id=$1",
      [r.id],
    );
    return r;
  });
  if (!task) return false;
  try {
    const data = (
      await db.query(
        "SELECT s.source,s.language,p.statement,p.input_spec,p.output_spec,p.constraints_text,p.references_code FROM reviews v JOIN code_snapshots s ON s.id=v.snapshot_id JOIN records r ON r.id=v.record_id JOIN problems p ON p.id=r.problem_id WHERE v.id=$1",
        [task.id],
      )
    ).rows[0];
    if (!data) return true;
    const response = await requestReview(options, {
      userCode: data.source,
      recommendedCode: data.references_code[data.language],
      problem: {
        statement: data.statement,
        input: data.input_spec,
        output: data.output_spec,
        constraints: data.constraints_text,
      },
    });
    // Provider usage is recorded even when output validation fails and the user's
    // review credit is returned. No source, prompt, API key or user ID is stored.
    await db.query(
      "INSERT INTO review_api_usage(id,provider,model,input_tokens,output_tokens,thinking_tokens) VALUES($1,$2,$3,$4,$5,$6)",
      [
        id(),
        options.provider ?? "openai",
        options.model,
        response.usage.input,
        response.usage.output,
        response.usage.thinking,
      ],
    );
    if (!response.complete) throw new Error("LLM_INCOMPLETE");
    const result = resultSchema.parse(JSON.parse(response.text));
    await db.tx(async (tx) => {
      const changed = await tx.query(
        "UPDATE reviews SET status='SUCCEEDED',result=$2,finished_at=now() WHERE id=$1 AND status='RUNNING' RETURNING *",
        [
          task.id,
          JSON.stringify({
            ...result,
            model: options.model,
            promptVersion: "2",
          }),
        ],
      );
      if (!changed.rows.length) return;
      await tx.query(
        "UPDATE review_allowances SET reserved=reserved-1,consumed=consumed+1 WHERE id=$1",
        [task.allowance_id],
      );
      await tx.query(
        "INSERT INTO review_credit_events(id,allowance_id,review_id,request_ref,type) VALUES($1,$2,$3,$3,'CONSUME')",
        [id(), task.allowance_id, task.id],
      );
      await businessEvent(
        tx,
        "REVIEW_SUCCEEDED",
        task.user_id,
        task.id,
        "review-terminal:" + task.id,
        { model: options.model },
      );
    });
  } catch {
    await db.tx((tx) => releaseReview(tx, task, "REVIEW_SERVICE_FAILED"));
  }
  return true;
}
export async function recoverReviews(db: DB) {
  await db.tx(async (tx) => {
    const pending = (
      await tx.query(
        "SELECT * FROM reviews WHERE status='RUNNING' AND started_at<now()-interval '5 minutes' FOR UPDATE",
      )
    ).rows;
    for (const r of pending) await releaseReview(tx, r, "REVIEW_INTERRUPTED");
  });
}
