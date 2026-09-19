// Executes trusted repository reference programs, never arbitrary submissions.
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { database } from "../apps/server/src/db.js";
import { seed } from "../apps/server/src/content.js";
const db = await database();
await seed(db);
const problems = (await db.query("SELECT * FROM problems ORDER BY id")).rows;
await db.close();
const dir = await mkdtemp(join(tmpdir(), "algostep-reference-"));
let runs = 0;
function run(command: string, args: string[], input?: string) {
  const r = spawnSync(command, args, {
    cwd: dir,
    input,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
  assert.ifError(r.error);
  assert.equal(r.status, 0, command + ": " + r.stderr);
  return r.stdout;
}
try {
  for (const p of problems) {
    for (const language of ["python", "cpp", "java"]) {
      const file = join(
        dir,
        language === "python"
          ? "main.py"
          : language === "cpp"
            ? "main.cpp"
            : "Main.java",
      );
      await writeFile(file, p.references_code[language]);
      if (language === "cpp")
        run(process.env.CXX ?? "g++", [
          "-std=c++20",
          "-O2",
          file,
          "-o",
          join(dir, process.platform === "win32" ? "main.exe" : "main"),
        ]);
      if (language === "java") run("javac", ["--release", "21", file]);
      for (const [i, t] of p.tests.entries()) {
        const actual =
          language === "python"
            ? run(process.env.PYTHON ?? "python", ["-B", file], t.input)
            : language === "cpp"
              ? run(
                  join(dir, process.platform === "win32" ? "main.exe" : "main"),
                  [],
                  t.input,
                )
              : run("java", ["-cp", dir, "Main"], t.input);
        // Windows runtime emits CRLF; production Linux judging remains byte-exact.
        assert.equal(
          process.platform === "win32" ? actual.replace(/\r\n/g, "\n") : actual,
          t.expected,
          p.id + " " + language + " case " + i,
        );
        runs++;
      }
    }
    console.log(
      p.id +
        ": all three languages passed (" +
        p.tests.length +
        " public cases)",
    );
  }
  console.log(
    JSON.stringify({
      problems: problems.length,
      programs: problems.length * 3,
      publicCases: problems.reduce((n, p) => n + p.tests.length, 0),
      runs,
    }),
  );
} finally {
  assert.equal(resolve(dirname(dir)), resolve(tmpdir()));
  assert.ok(basename(dir).startsWith("algostep-reference-"));
  await rm(dir, { recursive: true, force: true });
}
