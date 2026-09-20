import { lessonFrames, type LessonFrame } from "./lesson-model.js";
import { lessonExamples } from "./lesson-examples.js";
import {
  advancedLesson,
  advancedTopics,
  type AdvancedFrame,
} from "./advanced-lessons.js";

export type LearningFrame = {
  note: string;
  core?: LessonFrame;
  advanced?: AdvancedFrame;
};
export function learningFrames(topic: string): LearningFrame[] {
  if ((advancedTopics as readonly string[]).includes(topic))
    return advancedLesson(topic, 0).frames.map((advanced) => ({
      note: advanced.note,
      advanced,
    }));
  const e = lessonExamples(topic)[0];
  return lessonFrames(topic, e.values, e.target, e.graph).map((core) => ({
    note: core.note,
    core,
  }));
}
type Value =
  string | number | boolean | null | (string | number | boolean | null)[];
function fields(value: any, prefix = "", out: Record<string, Value> = {}) {
  if (value === null || ["string", "number", "boolean"].includes(typeof value))
    out[prefix] = value;
  else if (
    Array.isArray(value) &&
    value.every((v) => v === null || typeof v !== "object")
  )
    out[prefix] = value;
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) {
      if (!k.startsWith("$")) fields(v, prefix ? `${prefix}.${k}` : k, out);
    }
  return out;
}
export const answerText = (value: Value) =>
  Array.isArray(value) ? JSON.stringify(value) : String(value);
export function matchesAnswer(input: string, value: Value) {
  if (typeof value === "number")
    return input.trim() !== "" && Number(input.trim()) === value;
  if (Array.isArray(value)) {
    let actual: unknown;
    try {
      actual = JSON.parse(input);
    } catch {}
    if (!Array.isArray(actual)) {
      const raw = input.trim().replace(/^\[|\]$/g, "");
      actual = raw
        ? raw.includes(",")
          ? raw.split(",").map((s) => s.trim())
          : value.every((v) => typeof v === "number")
            ? raw.split(/\s+/)
            : [raw]
        : [];
    }
    return (
      JSON.stringify((actual as unknown[]).map(String)) ===
      JSON.stringify(value.map(String))
    );
  }
  return input.trim() === String(value);
}
export function checkpoints(topic: string) {
  const frames = learningFrames(topic);
  const checks: {
    current: LearningFrame;
    next: LearningFrame;
    field: string;
    answer: Value;
    choices?: { label: string; value: number }[];
  }[] = [];
  for (let i = 1; i < frames.length; i++) {
    const current = frames[i - 1],
      next = frames[i];
    const values = (f: LearningFrame) =>
      f.core?.vars ?? {
        rows: f.advanced!.rows,
        active: f
          .advanced!.nodes.filter((n) => n.state === "active")
          .map((n) => n.id)
          .sort(),
      };
    const before = fields(values(current));
    const after = fields(values(next));
    const changed = Object.keys(after).filter(
      (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
    );
    let field =
      [
        "answer",
        "current",
        "index",
        "mid",
        "a",
        "order",
        "queue",
        "stack",
      ].find((k) => changed.includes(k)) ??
      changed.find(
        (k) =>
          !k.startsWith("graph") &&
          !k.startsWith("matrix") &&
          !k.includes(".next"),
      ) ??
      changed[0];
    if (!field) continue;
    // Start binary search at its first comparison; sorted-input setup is not a prediction.
    if (topic === "binary-search" && current.core?.vars.mid === undefined)
      continue;
    const answer = after[field];
    let choices: { label: string; value: number }[] | undefined;
    if (
      ["mid", "index", "answer"].includes(field) &&
      typeof answer === "number"
    ) {
      const a = next.core?.vars.values ?? next.core?.vars.a ?? [];
      choices = a.map((v: number, index: number) => ({
        label: `${v} · 인덱스 ${index}`,
        value: index,
      }));
      if (answer === -1) choices!.push({ label: "찾지 못함 (-1)", value: -1 });
    } else if (field === "current" && next.core?.vars.graph)
      choices = next.core.vars.graph.map((_: unknown, index: number) => ({
        label: `정점 ${index}`,
        value: index,
      }));
    checks.push({ current, next, field, answer, choices });
  }
  return checks;
}
