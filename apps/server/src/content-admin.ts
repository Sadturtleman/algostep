import { readFile } from "node:fs/promises";
import { z } from "zod";
import { database } from "./db.js";
import { businessEvent } from "./business.js";
import { randomUUID } from "node:crypto";
const short = z.string().min(1).max(200),
  code = z.string().min(1).max(65536);
const languages = z.object({ python: code, cpp: code, java: code });
const topic = z.object({
  id: short,
  title: short,
  category: short,
  priority: z.enum(["P0", "P1", "P2"]),
  body: z.string().min(30).max(30000),
  complexity: short,
  quiz: z
    .object({
      question: short,
      options: z.array(short).min(2).max(6),
      answer: z.number().int().nonnegative(),
      explanation: z.string().min(1).max(4000),
    })
    .refine((v) => v.answer < v.options.length),
});
const problem = z.object({
  id: short,
  topic_id: short,
  version: z.number().int().positive(),
  title: short,
  statement: z.string().min(10).max(20000),
  input_spec: short,
  output_spec: short,
  constraints_text: short,
  tests: z
    .array(z.object({ input: code, expected: code }))
    .min(1)
    .max(100),
  references_code: languages,
  starters: languages,
  complexity_time: short,
  complexity_space: short,
});
export const catalog = z
  .object({
    topics: z.array(topic).max(200),
    problems: z.array(problem).max(200),
  })
  .superRefine((v, ctx) => {
    for (const list of [v.topics, v.problems])
      if (new Set(list.map((x) => x.id)).size !== list.length)
        ctx.addIssue({ code: "custom", message: "Duplicate IDs" });
  });
// Deliberately a CLI: publishing content requires database credentials, not a learner session.
if (process.argv[1]?.replaceAll("\\", "/").match(/content-admin\.(ts|js)$/)) {
  const path = process.argv[2];
  if (!path) throw new Error("Usage: content-admin <catalog.json> [--publish]");
  const data = catalog.parse(JSON.parse(await readFile(path, "utf8")));
  if (!process.argv.includes("--publish"))
    console.log(
      `Valid catalog: ${data.topics.length} topics, ${data.problems.length} problems. No changes written.`,
    );
  else {
    if (!process.env.DATABASE_URL)
      throw new Error("Publishing requires explicit DATABASE_URL");
    const db = await database(process.env.DATABASE_URL);
    try {
      await db.tx(async (tx) => {
        for (const t of data.topics)
          await tx.query(
            "INSERT INTO topics(id,title,category,priority,body,complexity,quiz) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET title=excluded.title,category=excluded.category,priority=excluded.priority,body=excluded.body,complexity=excluded.complexity,quiz=excluded.quiz",
            [
              t.id,
              t.title,
              t.category,
              t.priority,
              t.body,
              t.complexity,
              JSON.stringify(t.quiz),
            ],
          );
        // Existing problem versions cannot be overwritten; publish a new id/version.
        for (const p of data.problems)
          await tx.query(
            "INSERT INTO problems(id,topic_id,version,title,statement,input_spec,output_spec,constraints_text,tests,references_code,starters,complexity_time,complexity_space) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
            [
              p.id,
              p.topic_id,
              p.version,
              p.title,
              p.statement,
              p.input_spec,
              p.output_spec,
              p.constraints_text,
              JSON.stringify(p.tests),
              JSON.stringify(p.references_code),
              JSON.stringify(p.starters),
              p.complexity_time,
              p.complexity_space,
            ],
          );
        await tx.query(
          "INSERT INTO audit_events(action,metadata) VALUES('CONTENT_PUBLISH',$1)",
          [
            JSON.stringify({
              topics: data.topics.map((x) => x.id),
              problems: data.problems.map((x) => x.id),
            }),
          ],
        );
        await businessEvent(
          tx,
          "CONTENT_PUBLISHED",
          null,
          null,
          "publish:" + randomUUID(),
          { topics: data.topics.length, problems: data.problems.length },
        );
      });
      console.log("Catalog published atomically.");
    } finally {
      await db.close();
    }
  }
}
