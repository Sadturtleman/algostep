import { randomUUID, createHash } from "node:crypto";
import type { DB } from "./db.js";
export const id = randomUUID;
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export class DomainError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function kstMonth(at = new Date()) {
  return new Date(at.getTime() + 9 * 3600000).toISOString().slice(0, 7);
}
export function nextReset(at = new Date()) {
  const local = new Date(at.getTime() + 9 * 3600000);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) - 9 * 3600000,
  ).toISOString();
}
export async function ownRecord(db: DB, user: string, record: string) {
  const { rows } = await db.query(
    "SELECT * FROM records WHERE id=$1 AND user_id=$2 AND expires_at>now()",
    [record, user],
  );
  if (!rows[0])
    throw new DomainError(
      404,
      "RECORD_NOT_FOUND",
      "기록이 없거나 보관 기간이 지났어요.",
    );
  return rows[0];
}
export async function snapshot(db: DB, r: any) {
  const key = id();
  await db.query(
    "INSERT INTO code_snapshots(id,record_id,language,source,source_hash) VALUES($1,$2,$3,$4,$5)",
    [key, r.id, r.language, r.source, hash(r.source)],
  );
  return key;
}
export async function releaseReview(db: DB, review: any, reason: string) {
  const changed = await db.query(
    "UPDATE reviews SET status='FAILED',failure_code=$2,finished_at=now() WHERE id=$1 AND status IN ('QUEUED','RUNNING') RETURNING *",
    [review.id, reason],
  );
  if (!changed.rows.length) return;
  await db.query(
    "UPDATE review_allowances SET reserved=reserved-1 WHERE id=$1",
    [review.allowance_id],
  );
  await db.query(
    "INSERT INTO review_credit_events(id,allowance_id,review_id,request_ref,type) VALUES($1,$2,$3,$3,'RELEASE')",
    [id(), review.allowance_id, review.id],
  );
}
export async function deleteRecord(db: DB, record: string) {
  const pending = await db.query(
    "SELECT * FROM reviews WHERE record_id=$1 AND status IN ('QUEUED','RUNNING') FOR UPDATE",
    [record],
  );
  for (const r of pending.rows) await releaseReview(db, r, "RECORD_DELETED");
  await db.query("DELETE FROM records WHERE id=$1", [record]);
}
export async function cleanExpired(db: DB) {
  await db.tx(async (tx) => {
    const rows = await tx.query(
      "SELECT id FROM records WHERE expires_at<=now() FOR UPDATE",
    );
    for (const r of rows.rows) await deleteRecord(tx, r.id);
  });
}
export function analysis(
  language: string,
  source: string,
  reference: string,
  topic: any,
) {
  // A catalog proof is valid only for an exact, curated solution. No heuristic Big-O claims.
  if (source === reference)
    return {
      status: "SUPPORTED",
      method: "CURATED_REFERENCE_MATCH",
      time: topic.complexity.split("|")[0],
      space: topic.complexity.split("|")[1],
      evidence:
        "등록된 권장 코드와 정확히 일치하는 코드입니다. 입력 크기 기준이며 실행 측정치와 구분합니다.",
      language,
    };
  return {
    status: "UNSUPPORTED",
    time: null,
    space: null,
    evidence:
      "이 코드의 점근적 복잡도를 자동으로 증명할 수 없어요. 테스트별 시간·메모리 측정치는 확인할 수 있어요.",
    language,
  };
}
