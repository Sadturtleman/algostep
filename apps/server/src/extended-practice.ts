import type { DB } from "./db.js";
import { corePractice } from "./practice-core.js";
import { graphPractice } from "./practice-graphs.js";
import { structurePractice } from "./practice-structures.js";
import { advancedPractice } from "./practice-advanced.js";
import { treePractice } from "./practice-trees.js";
import { mathPractice } from "./practice-math.js";
export const extendedPractice = [
  ...corePractice,
  ...graphPractice,
  ...structurePractice,
  ...advancedPractice,
  ...treePractice,
  ...mathPractice,
];
export async function seedExtendedPractice(db: DB) {
  for (const s of extendedPractice) {
    await db.query(
      "INSERT INTO problems(id,topic_id,version,title,statement,input_spec,output_spec,constraints_text,tests,references_code,starters,complexity_time,complexity_space) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING",
      [
        s.topic + "-v1",
        s.topic,
        s.title,
        s.statement,
        s.input,
        s.output + " (모든 줄 끝에 줄바꿈, 불필요한 공백 없음)",
        s.constraints,
        JSON.stringify(s.tests),
        JSON.stringify(s.refs),
        JSON.stringify({
          python: "# 전체 프로그램을 작성하세요.\n",
          cpp: "#include <iostream>\nint main() {\n}\n",
          java: "public class Main { public static void main(String[] args) {\n}\n}\n",
        }),
        s.time,
        s.space,
      ],
    );
  }
}
