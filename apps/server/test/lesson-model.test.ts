import { test } from "node:test";
import assert from "node:assert/strict";
import { lessonFrames } from "../../web/src/lesson-model.js";
import { lessonExamples } from "../../web/src/lesson-examples.js";
import { graphPositions } from "../../web/src/DiagramCanvas.js";

test("graph presets preserve cycles, disconnected vertices and nonoverlapping automatic positions", () => {
  for (const topic of ["bfs", "dfs", "graph-list", "graph-matrix"])
    for (const example of lessonExamples(topic)) {
      const frames = lessonFrames(
        topic,
        example.values,
        example.target,
        example.graph,
      );
      const last = frames.at(-1)!.vars;
      assert.equal(new Set(last.order).size, last.order.length);
      if (example.title === "연결되지 않은 정점")
        assert.deepEqual([...last.order].sort(), [0, 1, 2]);
      const pos = graphPositions(example.graph!);
      for (let i = 0; i < pos.length; i++)
        for (let j = i + 1; j < pos.length; j++)
          assert.ok(
            Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y) >= 100,
          );
    }
});
test("interactive sorting models handle duplicates, negative and single values", () => {
  for (const topic of [
    "bubble-sort",
    "selection-sort",
    "insertion-sort",
    "merge-sort",
    "quick-sort",
  ])
    for (const values of [[3, -1, 3, 0], [1], [5, 4, 3, 2, 1]]) {
      const frames = lessonFrames(topic, values);
      assert.deepEqual(
        frames.at(-1)!.vars.a,
        [...values].sort((a, b) => a - b),
      );
      assert.deepEqual(frames[0].vars.a, values);
    }
});
test("every P0 topic has bounded interactive learning frames", () => {
  for (const topic of [
    "array",
    "stack",
    "queue",
    "linked-list",
    "hash",
    "bst",
    "heap",
    "graph-list",
    "graph-matrix",
    "linear-search",
    "binary-search",
    "sorting",
    "bubble-sort",
    "selection-sort",
    "insertion-sort",
    "merge-sort",
    "quick-sort",
    "tree",
    "bfs",
    "dfs",
    "recursion",
    "brute-force",
    "backtracking",
    "two-pointer",
    "sliding-window",
    "prefix-sum",
    "greedy",
    "dp",
    "memoization",
    "tabulation",
  ]) {
    const examples = lessonExamples(topic);
    assert.equal(examples.length, 3, topic);
    for (const example of examples)
      assert.ok(
        lessonFrames(topic, example.values, example.target, example.graph)
          .length > 0,
        `${topic}: ${example.title}`,
      );
    const frames = lessonFrames(topic, [4, 1, 3, 2], 7);
    assert.ok(frames.length > 1, topic);
    assert.ok(frames.length <= 200, topic);
  }
});
