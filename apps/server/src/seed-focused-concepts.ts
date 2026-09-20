import type { DB } from "./db.js";
import { focusedConcepts } from "./focused-concepts.js";

export async function seedFocusedConcepts(db: DB) {
  const parents = new Map(
    (
      await db.query("SELECT id,category,priority,complexity FROM topics")
    ).rows.map((t) => [t.id, t]),
  );
  const rows = focusedConcepts.map((c) => {
    const parent = parents.get(c.parent);
    if (!parent) throw new Error(`Missing curriculum parent: ${c.parent}`);
    const options = [
      c.principle,
      "입력 조건이나 경계는 결과에 영향을 주지 않습니다.",
      "모든 입력에서 같은 결과를 반환합니다.",
    ];
    const shift = c.id.length % 3;
    const choices = [...options.slice(shift), ...options.slice(0, shift)];
    return [
      c.id,
      c.title,
      parent.category,
      parent.priority,
      c.principle,
      parent.complexity,
      JSON.stringify({
        question: `${c.title}에 대한 설명으로 옳은 것은?`,
        options: choices,
        answer: choices.indexOf(c.principle),
        explanation: c.example,
      }),
    ];
  });
  // Two round trips regardless of lesson count; important for remote DB cold starts.
  const placeholders = rows
    .map(
      (_, i) =>
        `(${Array.from({ length: 7 }, (_, j) => `$${i * 7 + j + 1}`).join(",")})`,
    )
    .join(",");
  await db.query(
    `INSERT INTO topics(id,title,category,priority,body,complexity,quiz) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
    rows.flat(),
  );
}
