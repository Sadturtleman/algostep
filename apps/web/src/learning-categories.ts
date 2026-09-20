import { practiceTopic } from "../../server/src/focused-concepts.js";
const categories: [string, string[]][] = [
  ["기초와 설계", ["recursion", "prefix-sum", "greedy"]],
  [
    "자료구조",
    [
      "array",
      "linked-list",
      "stack",
      "queue",
      "hash",
      "heap",
      "union-find",
      "trie",
    ],
  ],
  [
    "탐색",
    [
      "linear-search",
      "binary-search",
      "brute-force",
      "backtracking",
      "two-pointer",
      "sliding-window",
    ],
  ],
  [
    "정렬",
    [
      "sorting",
      "bubble-sort",
      "selection-sort",
      "insertion-sort",
      "merge-sort",
      "quick-sort",
    ],
  ],
  ["트리", ["tree", "bst", "balanced-tree", "segment-tree", "fenwick", "lca"]],
  [
    "그래프",
    [
      "graph-list",
      "graph-matrix",
      "bfs",
      "dfs",
      "dijkstra",
      "bellman-ford",
      "floyd-warshall",
      "mst",
      "topological-sort",
      "scc",
      "flow",
    ],
  ],
  ["동적 계획법", ["dp", "memoization", "tabulation", "advanced-dp"]],
  ["문자열", ["kmp"]],
  ["수학과 기하", ["geometry", "fft"]],
];
export function learningCategory(topic: { id: string; category: string }) {
  return (
    categories.find(([, ids]) => ids.includes(practiceTopic(topic.id)))?.[0] ??
    topic.category
  );
}
export function groupLearningTopics<
  T extends { id: string; title: string; category: string },
>(topics: T[], search = "") {
  const query = search.trim().toLocaleLowerCase();
  const names = [
    ...categories.map(([name]) => name),
    ...topics.map(learningCategory),
  ];
  return [...new Set(names)]
    .map((name) => {
      const order = categories.find(([label]) => label === name)?.[1] ?? [];
      return {
        name,
        topics: topics
          .filter(
            (t) =>
              learningCategory(t) === name &&
              `${t.title} ${name} ${t.category}`
                .toLocaleLowerCase()
                .includes(query),
          )
          .sort((a, b) => {
            const ai = order.indexOf(a.id),
              bi = order.indexOf(b.id);
            return (
              (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi) ||
              a.title.localeCompare(b.title, "ko")
            );
          }),
      };
    })
    .filter((group) => group.topics.length > 0);
}
