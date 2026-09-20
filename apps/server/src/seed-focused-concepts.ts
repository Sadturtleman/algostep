import type { DB } from "./db.js";
import { focusedConcepts } from "./focused-concepts.js";

export async function seedFocusedConcepts(db: DB) {
  for (const c of focusedConcepts) {
    const parent = (
      await db.query("SELECT * FROM topics WHERE id=$1", [c.parent])
    ).rows[0];
    if (!parent) throw new Error(`Missing curriculum parent: ${c.parent}`);
    const options = [
      c.principle,
      "입력 조건이나 경계는 결과에 영향을 주지 않습니다.",
      "모든 입력에서 같은 결과를 반환합니다.",
    ];
    const shift = c.id.length % 3;
    const choices = [...options.slice(shift), ...options.slice(0, shift)];
    await db.query(
      "INSERT INTO topics(id,title,category,priority,body,complexity,quiz) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING",
      [
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
      ],
    );
  }
}
