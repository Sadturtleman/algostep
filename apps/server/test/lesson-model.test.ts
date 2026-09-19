import { test } from "node:test";
import assert from "node:assert/strict";
import { lessonFrames } from "../../web/src/lesson-model.js";
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
    const frames = lessonFrames(topic, [4, 1, 3, 2], 7);
    assert.ok(frames.length > 1, topic);
    assert.ok(frames.length <= 200, topic);
  }
});
