import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advancedLesson,
  advancedTopics,
} from "../../web/src/advanced-lessons.js";
const result = (topic: string, v = 0): any =>
  advancedLesson(topic, v).frames.at(-1)!.result;
test("all 17 advanced topics have three bounded, independent, drawable scenarios", () => {
  assert.equal(advancedTopics.length, 17);
  for (const topic of advancedTopics)
    for (let v = 0; v < 3; v++) {
      const lesson = advancedLesson(topic, v);
      assert.ok(lesson.title && lesson.description && lesson.complexity, topic);
      assert.ok(lesson.frames.length >= 2 && lesson.frames.length < 250, topic);
      assert.notEqual(lesson.frames[0], lesson.frames.at(-1));
      assert.ok(lesson.frames.at(-1)!.result, topic);
      for (const f of lesson.frames) {
        const ids = new Set(f.nodes.map((n) => n.id));
        assert.equal(ids.size, f.nodes.length, topic);
        for (const n of f.nodes)
          assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y), topic);
        for (const e of f.edges)
          assert.ok(ids.has(e.from) && ids.has(e.to), topic);
      }
    }
});
test("shortest paths, negative cycles, topological ordering, SCC and max flow", () => {
  assert.deepEqual(result("dijkstra").dist, [0, 3, 1, 4, 7]);
  assert.equal(result("dijkstra", 2).dist[4], Infinity);
  assert.deepEqual(result("bellman-ford").dist, [0, 4, 2, 5, 6]);
  assert.equal(result("bellman-ford", 1).negativeCycle, true);
  assert.equal(result("bellman-ford", 2).negativeCycle, false);
  assert.deepEqual(result("floyd-warshall").dist[0], result("dijkstra").dist);
  assert.equal(result("mst").total, 7);
  assert.equal(result("mst", 2).components, 2);
  assert.deepEqual(result("topological-sort").order, [0, 2, 1, 3, 4]);
  assert.equal(result("topological-sort", 1).cycle, true);
  const c = result("scc", 1);
  assert.equal(c.count, 2);
  assert.equal(c.component[0], c.component[2]);
  assert.equal(c.component[3], c.component[4]);
  assert.notEqual(c.component[0], c.component[3]);
  assert.equal(result("flow").maxFlow, 5);
  assert.equal(result("flow", 1).maxFlow, 3);
  assert.equal(result("flow", 2).maxFlow, 0);
});
test("range sums, trie reuse, union representatives, KMP and LCA", () => {
  for (let v = 0; v < 3; v++) {
    for (const t of ["segment-tree", "fenwick"]) {
      const r = result(t, v);
      assert.equal(
        r.sum,
        r.a.slice(1).reduce((a: number, b: number) => a + b, 0),
      );
    }
  }
  assert.equal(result("trie").nodeCount, 8);
  assert.equal(result("trie", 2).nodeCount, 5);
  assert.equal(new Set(result("union-find", 2).parent).size, 1);
  assert.deepEqual(result("kmp").matches, [4]);
  assert.deepEqual(result("kmp", 1).matches, [0, 1, 2]);
  assert.deepEqual(result("kmp", 2).matches, []);
  assert.deepEqual(
    [0, 1, 2].map((v) => result("lca", v).lca),
    [0, 1, 5],
  );
});
test("AVL ordering and balance, optimized DP against exhaustive recurrence, FFT against convolution", () => {
  for (let v = 0; v < 3; v++) {
    const tree = result("balanced-tree", v).root;
    const check = (n: any, min = -Infinity, max = Infinity): number => {
      if (!n) return 0;
      assert.ok(n.v > min && n.v < max);
      const l = check(n.l, min, n.v),
        r = check(n.r, n.v, max);
      assert.ok(Math.abs(l - r) <= 1);
      return 1 + Math.max(l, r);
    };
    check(tree);
    const { a, cost } = result("advanced-dp", v),
      n = a.length;
    const d = Array.from({ length: 4 }, () => Array(n + 1).fill(Infinity));
    d[0][0] = 0;
    for (let k = 1; k <= 3; k++)
      for (let i = k; i <= n; i++)
        for (let j = k - 1; j < i; j++)
          d[k][i] = Math.min(
            d[k][i],
            d[k - 1][j] +
              a.slice(j, i).reduce((x: number, y: number) => x + y, 0) ** 2,
          );
    assert.equal(cost, d[3][n]);
    const r = result("fft", v),
      expected = Array(r.a.length + r.b.length - 1).fill(0);
    r.a.forEach((x: number, i: number) =>
      r.b.forEach((y: number, j: number) => (expected[i + j] += x * y)),
    );
    assert.deepEqual(r.coefficients, expected);
  }
  assert.deepEqual(result("geometry").hull, [
    [0, 0],
    [4, 0],
    [4, 3],
    [0, 3],
  ]);
  assert.deepEqual(result("geometry", 1).hull, [
    [0, 0],
    [3, 3],
  ]);
  assert.deepEqual(result("geometry", 2).hull, [
    [0, 0],
    [3, 0],
    [1, 3],
  ]);
});
