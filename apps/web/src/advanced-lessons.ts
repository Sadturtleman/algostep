import type { DiagramNode, DiagramEdge } from "./DiagramCanvas.js";

export const advancedTopics = [
  "union-find",
  "trie",
  "segment-tree",
  "fenwick",
  "dijkstra",
  "bellman-ford",
  "floyd-warshall",
  "mst",
  "topological-sort",
  "kmp",
  "balanced-tree",
  "scc",
  "lca",
  "advanced-dp",
  "geometry",
  "fft",
  "flow",
] as const;
export type AdvancedFrame = {
  note: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  rows: (string | number)[][];
  result?: unknown;
};
export type AdvancedLesson = {
  title: string;
  description: string;
  complexity: string;
  frames: AdvancedFrame[];
};
type Edge = [number, number, number];
const show = (n: number) => (Number.isFinite(n) ? String(n) : "∞");
const card = (
  id: string,
  label: string,
  i: number,
  detail = "",
  active = false,
): DiagramNode => ({
  id,
  label,
  detail,
  x: 80 + (i % 5) * 145,
  y: 65 + Math.floor(i / 5) * 110,
  shape: "card",
  width: 125,
  height: 75,
  state: active ? "active" : "",
});

/** Small, deterministic real algorithms. Each emission is an immutable state snapshot. */
export function advancedLesson(topic: string, variant = 0): AdvancedLesson {
  const frames: AdvancedFrame[] = [];
  const emit = (
    note: string,
    nodes: DiagramNode[],
    edges: DiagramEdge[] = [],
    rows: (string | number)[][] = [],
    result?: unknown,
  ) => frames.push(structuredClone({ note, nodes, edges, rows, result }));
  let title = "",
    description = "",
    complexity = "";
  const network = (
    n: number,
    edges: Edge[],
    labels: string[] = [],
    active = -1,
  ) => ({
    nodes: Array.from({ length: n }, (_, i) => ({
      id: String(i),
      label: String(i),
      detail: labels[i] ?? "",
      x: 310 + Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / n) * 220,
      y: 280 + Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / n) * 220,
      state: i === active ? "active" : "",
    })),
    edges: edges.map(([u, v, w]) => ({
      from: String(u),
      to: String(v),
      label: ["topological-sort", "scc"].includes(topic)
        ? undefined
        : String(w),
      directed: true,
    })),
  });
  if (
    [
      "dijkstra",
      "bellman-ford",
      "floyd-warshall",
      "mst",
      "topological-sort",
      "scc",
      "flow",
    ].includes(topic)
  ) {
    const n = 5;
    let edges: Edge[] =
      variant === 0
        ? [
            [0, 1, 4],
            [0, 2, 1],
            [2, 1, 2],
            [1, 3, 1],
            [2, 3, 5],
            [3, 4, 3],
          ]
        : variant === 1
          ? [
              [0, 1, 2],
              [1, 2, 1],
              [2, 0, 4],
              [1, 3, 3],
              [3, 4, 1],
              [4, 3, 2],
            ]
          : [
              [0, 1, 3],
              [1, 2, 2],
              [3, 4, 1],
            ];
    let reverseView = false;
    const draw = (
      note: string,
      rows: (string | number)[][] = [],
      labels: string[] = [],
      active = -1,
      result?: unknown,
    ) => {
      const g = network(
        n,
        reverseView ? edges.map(([u, v, w]): Edge => [v, u, w]) : edges,
        labels,
        active,
      );
      emit(note, g.nodes, g.edges, rows, result);
    };
    if (topic === "dijkstra" || topic === "bellman-ford") {
      if (topic === "bellman-ford" && variant === 1)
        edges = [
          [0, 1, 2],
          [1, 2, -4],
          [2, 1, 1],
          [2, 3, 2],
          [3, 4, 1],
        ];
      if (topic === "bellman-ford" && variant === 0)
        edges = [
          [0, 1, 4],
          [0, 2, 5],
          [1, 2, -2],
          [2, 3, 3],
          [3, 4, 1],
        ];
      title = ["우회 경로의 개선", "사이클 검사", "도달 불가능한 정점"][
        variant
      ];
      description =
        topic === "dijkstra"
          ? "시작 정점은 0입니다. 음이 아닌 간선에서 최소 거리 정점을 확정하고 이웃을 완화합니다."
          : "0에서 출발해 모든 간선을 반복 완화합니다. 음수 간선과 도달 가능한 음수 사이클을 구분합니다.";
      complexity =
        topic === "dijkstra"
          ? "이 예제: 선형 최소 선택 O(V²+E), 공간 O(V+E). 우선순위 큐 구현은 O((V+E) log V)."
          : "시간 O(VE), 공간 O(V+E).";
      const dist = Array(n).fill(Infinity),
        prev = Array(n).fill(-1),
        used = Array(n).fill(false);
      dist[0] = 0;
      const state = (note: string, v = -1, result?: unknown) =>
        draw(
          note,
          [
            [
              "정점",
              "거리",
              "이전 정점",
              topic === "dijkstra" ? "확정 여부" : "처리",
            ],
            ...dist.map((d, i) => [
              i,
              show(d),
              prev[i],
              topic === "dijkstra" ? (used[i] ? "확정" : "대기") : "완화",
            ]),
          ],
          dist.map(show),
          v,
          result,
        );
      state("거리[0]=0, 나머지는 ∞로 초기화");
      if (topic === "dijkstra") {
        for (let round = 0; round < n; round++) {
          let u = -1;
          for (let i = 0; i < n; i++)
            if (!used[i] && (u < 0 || dist[i] < dist[u])) u = i;
          if (u < 0 || !Number.isFinite(dist[u])) break;
          used[u] = true;
          state(`정점 ${u}의 최단 거리 ${dist[u]} 확정`, u);
          for (const [a, b, w] of edges)
            if (a === u && dist[b] > dist[a] + w) {
              dist[b] = dist[a] + w;
              prev[b] = a;
              state(`${a}→${b}: 거리 ${dist[b]}로 갱신`, b);
            }
        }
        state("완료: ∞는 시작점에서 도달할 수 없는 정점입니다.", -1, {
          dist,
          prev,
        });
      } else {
        for (let pass = 1; pass < n; pass++) {
          let changed = false;
          for (const [a, b, w] of edges)
            if (Number.isFinite(dist[a]) && dist[b] > dist[a] + w) {
              dist[b] = dist[a] + w;
              prev[b] = a;
              changed = true;
              state(`${pass}회차: ${a}→${b} 완화`, b);
            }
          if (!changed) break;
        }
        const negativeCycle = edges.some(
          ([a, b, w]) => Number.isFinite(dist[a]) && dist[b] > dist[a] + w,
        );
        state(
          negativeCycle
            ? "추가 완화가 가능합니다. 도달 가능한 음수 사이클이 있어 최단 거리를 확정할 수 없습니다."
            : "추가 완화 없음: 최단 거리 계산 완료",
          -1,
          { dist, negativeCycle },
        );
      }
    } else if (topic === "floyd-warshall") {
      title = ["우회 경로", "사이클이 있는 그래프", "분리된 그래프"][variant];
      description =
        "각 단계에서 정점 k를 경유지로 허용합니다. 표는 모든 정점 쌍의 거리입니다.";
      complexity = "시간 O(V³), 공간 O(V²).";
      const d = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)),
      );
      for (const [u, v, w] of edges) d[u][v] = Math.min(d[u][v], w);
      draw(
        "직접 간선과 자기 자신까지의 거리 초기화",
        d.map((r, i) => [i, ...r.map(show)]),
      );
      for (let k = 0; k < n; k++) {
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n; j++)
            if (d[i][j] > d[i][k] + d[k][j]) {
              d[i][j] = d[i][k] + d[k][j];
              draw(
                `${i}→${k}→${j} 경유로 거리 ${d[i][j]}`,
                d.map((r, x) => [x, ...r.map(show)]),
                [],
                k,
              );
            }
        draw(
          `경유 정점 ${k} 처리 완료`,
          d.map((r, i) => [i, ...r.map(show)]),
          [],
          k,
        );
      }
      draw(
        "모든 쌍 최단 거리 완료",
        d.map((r, i) => [i, ...r.map(show)]),
        [],
        -1,
        { dist: d },
      );
    } else if (topic === "mst") {
      title = ["최소 간선 선택", "사이클 간선 제외", "최소 신장 숲"][variant];
      description =
        "간선을 무방향으로 취급하는 Kruskal 알고리즘입니다. 연결되지 않으면 신장 트리 대신 신장 숲을 구합니다.";
      complexity = "시간 O(E log E), 공간 O(V+E).";
      const parent = Array.from({ length: n }, (_, i) => i),
        size = Array(n).fill(1),
        chosen: Edge[] = [];
      let total = 0;
      const root = (v: number): number =>
        parent[v] === v ? v : (parent[v] = root(parent[v]));
      const mstState = (note: string, result?: unknown) => {
        const g = network(n, edges);
        emit(
          note,
          g.nodes,
          g.edges.map((e) => ({
            ...e,
            directed: false,
            label:
              (chosen.some(
                ([u, v]) => String(u) === e.from && String(v) === e.to,
              )
                ? "✓ "
                : "") + e.label,
          })),
          [
            ["선택 간선", chosen.length],
            ["비용 합", total],
            ...parent.map((p, i) => [i, root(i)]),
          ],
          result,
        );
      };
      mstState("간선 가중치 오름차순으로 검사");
      for (const e of [...edges].sort((a, b) => a[2] - b[2])) {
        const [u, v, w] = e,
          a = root(u),
          b = root(v);
        if (a !== b) {
          if (size[a] < size[b]) {
            parent[a] = b;
            size[b] += size[a];
          } else {
            parent[b] = a;
            size[a] += size[b];
          }
          chosen.push(e);
          total += w;
          mstState(`${u}—${v} 선택 (+${w})`);
        } else mstState(`${u}—${v} 제외: 사이클 생성`);
      }
      mstState(
        chosen.length === n - 1
          ? "최소 신장 트리 완성"
          : "연결되지 않아 최소 신장 숲을 반환합니다.",
        { total, chosen, components: n - chosen.length },
      );
    } else if (topic === "topological-sort") {
      title = ["선행 관계 정렬", "사이클로 정렬 실패", "독립 작업"][variant];
      description =
        "Kahn 알고리즘: 진입 차수가 0인 정점을 큐에서 꺼내고 나가는 간선을 제거합니다.";
      complexity = "시간·공간 O(V+E).";
      const degree = Array(n).fill(0);
      const adj = Array.from({ length: n }, () => [] as number[]);
      for (const [u, v] of edges) adj[u].push(v);
      for (const [, v] of edges) degree[v]++;
      const queue = degree.flatMap((d, i) => (d === 0 ? [i] : [])),
        order: number[] = [];
      let head = 0;
      const state = (note: string, u = -1, result?: unknown) =>
        draw(
          note,
          [
            ["큐", queue.slice(head).join(", ")],
            ["결과", order.join(", ")],
            ...degree.map((d, i) => [i, d]),
          ],
          degree.map((d) => `진입 ${d}`),
          u,
          result,
        );
      state("진입 차수 0인 정점을 큐에 추가");
      while (head < queue.length) {
        const u = queue[head++];
        order.push(u);
        for (const b of adj[u]) if (--degree[b] === 0) queue.push(b);
        state(`${u} 처리 후 진입 차수 갱신`, u);
      }
      state(
        order.length === n
          ? "위상 정렬 완료"
          : "사이클이 있어 모든 정점을 정렬할 수 없습니다.",
        -1,
        { order, cycle: order.length !== n },
      );
    } else if (topic === "scc") {
      title = ["단방향 그래프", "서로 도달하는 두 집합", "분리된 그래프"][
        variant
      ];
      description =
        "Kosaraju 알고리즘: 원래 그래프의 DFS 종료 역순으로 역방향 그래프를 탐색합니다.";
      complexity = "시간·공간 O(V+E).";
      const adj = Array.from({ length: n }, () => [] as number[]),
        reverse = Array.from({ length: n }, () => [] as number[]);
      for (const [u, v] of edges) {
        adj[u].push(v);
        reverse[v].push(u);
      }
      const seen = new Set<number>(),
        order: number[] = [],
        component = Array(n).fill(-1);
      const dfs = (u: number) => {
        seen.add(u);
        draw(`${u} 첫 번째 DFS 진입`, [["종료 순서", order.join(", ")]], [], u);
        for (const b of adj[u]) if (!seen.has(b)) dfs(b);
        order.push(u);
        draw(`${u} 종료 순서에 추가`, [["종료 순서", order.join(", ")]], [], u);
      };
      for (let i = 0; i < n; i++) if (!seen.has(i)) dfs(i);
      reverseView = true;
      draw("모든 간선을 뒤집고 종료 역순으로 두 번째 DFS를 시작합니다.");
      let count = 0;
      const rev = (u: number) => {
        component[u] = count;
        draw(
          `역방향 탐색: ${u}를 SCC ${count}에 배정`,
          component.map((c, i) => [i, c]),
          component.map((c) => `SCC ${c}`),
          u,
        );
        for (const a of reverse[u]) if (component[a] < 0) rev(a);
      };
      for (const u of [...order].reverse())
        if (component[u] < 0) {
          rev(u);
          count++;
        }
      draw(
        `${count}개 강한 연결 요소 완성`,
        component.map((c, i) => [i, c]),
        component.map((c) => `SCC ${c}`),
        -1,
        { component, count },
      );
    } else {
      edges =
        variant === 0
          ? [
              [0, 1, 3],
              [0, 2, 2],
              [1, 2, 1],
              [1, 3, 2],
              [2, 3, 3],
              [3, 4, 5],
            ]
          : variant === 1
            ? [
                [0, 1, 5],
                [0, 2, 4],
                [1, 3, 2],
                [2, 3, 2],
                [3, 4, 3],
              ]
            : [
                [0, 1, 3],
                [1, 2, 2],
                [3, 4, 2],
              ];
      title = ["여러 증가 경로", "병목 용량", "도착점 단절"][variant];
      description =
        "Edmonds–Karp: 잔여 용량이 양수인 간선으로 BFS 증가 경로를 찾습니다. 0이 소스, 4가 싱크입니다. 역방향 잔여 간선도 표시합니다.";
      complexity = "시간 O(VE²), 이 행렬 구현의 공간 O(V²).";
      const cap = Array.from({ length: n }, () => Array(n).fill(0));
      const adj = Array.from({ length: n }, () => new Set<number>());
      for (const [u, v] of edges) {
        adj[u].add(v);
        adj[v].add(u);
      }
      for (const [u, v, w] of edges) cap[u][v] += w;
      let total = 0;
      const state = (note: string, path: number[] = [], result?: unknown) => {
        const residual: Edge[] = [];
        for (let u = 0; u < n; u++)
          for (let v = 0; v < n; v++)
            if (cap[u][v] > 0) residual.push([u, v, cap[u][v]]);
        const g = network(n, residual);
        emit(
          note,
          g.nodes.map((x) => ({
            ...x,
            state: path.includes(Number(x.id)) ? "active" : "",
          })),
          g.edges,
          [
            ["총 유량", total],
            ["증가 경로", path.join(" → ")],
            ["잔여 용량", 0, 1, 2, 3, 4],
            ...cap.map((r, i) => [i, ...r]),
          ],
          result,
        );
      };
      state("잔여 그래프 초기화");
      while (true) {
        const parent = Array(n).fill(-1),
          q = [0];
        parent[0] = 0;
        let head = 0;
        while (head < q.length && parent[4] < 0) {
          const u = q[head++];
          for (const v of adj[u])
            if (parent[v] < 0 && cap[u][v] > 0) {
              parent[v] = u;
              q.push(v);
            }
        }
        if (parent[4] < 0) break;
        const path = [4];
        let amount = Infinity;
        for (let v = 4; v !== 0; v = parent[v]) {
          amount = Math.min(amount, cap[parent[v]][v]);
          path.unshift(parent[v]);
        }
        state(`증가 경로 발견: 병목 용량 ${amount}`, path);
        for (let v = 4; v !== 0; v = parent[v]) {
          cap[parent[v]][v] -= amount;
          cap[v][parent[v]] += amount;
        }
        total += amount;
        state(`${amount}만큼 유량 증가, 역방향 잔여 용량 갱신`, path);
      }
      state("더 이상 증가 경로가 없습니다. 최대 유량 확정", [], {
        maxFlow: total,
      });
    }
  } else if (topic === "union-find") {
    title = ["집합 합치기", "중복 연결", "경로 압축"][variant];
    description =
      "크기 기준 합치기와 경로 압축을 함께 사용합니다. 화살표는 각 원소의 부모입니다.";
    complexity = "m회 연산 O(m α(n)), 공간 O(n).";
    const parent = Array.from({ length: 6 }, (_, i) => i),
      size = Array(6).fill(1);
    const state = (note: string, result?: unknown) =>
      emit(
        note,
        parent.map((p, i) => card(String(i), String(i), i, `부모 ${p}`)),
        parent.flatMap((p, i) =>
          p === i ? [] : [{ from: String(i), to: String(p), directed: true }],
        ),
        parent.map((p, i) => [i, p, size[i]]),
        result,
      );
    const find = (x: number): number => {
      if (parent[x] === x) return x;
      const r = find(parent[x]);
      if (parent[x] !== r) {
        parent[x] = r;
        state(`${x}의 부모를 대표 ${r}로 압축`);
      }
      return r;
    };
    const ops =
      variant === 0
        ? [
            [0, 1],
            [2, 3],
            [1, 3],
            [4, 5],
          ]
        : variant === 1
          ? [
              [0, 1],
              [1, 2],
              [0, 2],
              [3, 4],
            ]
          : [
              [0, 1],
              [2, 3],
              [0, 2],
              [4, 5],
              [0, 4],
            ];
    state("모든 원소가 독립된 집합");
    for (const [u, v] of ops) {
      let a = find(u),
        b = find(v);
      if (a === b) {
        state(`${u}, ${v}는 이미 같은 집합`);
        continue;
      }
      if (size[a] < size[b]) [a, b] = [b, a];
      parent[b] = a;
      size[a] += size[b];
      state(`${u}, ${v} 합치기: 대표 ${a}`);
    }
    for (let i = 0; i < 6; i++) find(i);
    state("모든 원소의 대표 확인 완료", { parent, size });
  } else if (topic === "segment-tree" || topic === "fenwick") {
    const a =
      variant === 0
        ? [2, 1, 3, 4]
        : variant === 1
          ? [0, -2, 5, 1]
          : [7, 7, 7, 7];
    title = ["구간 합과 갱신", "음수를 포함한 합", "같은 값의 갱신"][variant];
    description =
      topic === "segment-tree"
        ? "합 세그먼트 트리를 만들고 인덱스 1을 6으로 갱신한 뒤 [1,3] 합을 질의합니다."
        : "1 기반 펜윅 트리를 구성하고 인덱스 2를 6으로 갱신합니다. prefix(4)−prefix(1)로 [2,4] 합을 구합니다.";
    complexity =
      "갱신·질의 O(log n), 공간 O(n). 이 예제는 반복 삽입으로 구성합니다.";
    if (topic === "segment-tree") {
      const tree = Array(8).fill(0);
      const nodes = () =>
        Array.from({ length: 7 }, (_, i) => {
          const k = i + 1,
            depth = Math.floor(Math.log2(k));
          return {
            id: String(k),
            label: String(tree[k]),
            detail: `노드 ${k}`,
            x: 80 + ((k - 2 ** depth + 0.5) * 520) / 2 ** depth,
            y: 60 + depth * 110,
          };
        });
      const edges = Array.from({ length: 6 }, (_, i) => ({
        from: String(Math.floor((i + 2) / 2)),
        to: String(i + 2),
      }));
      const state = (note: string, result?: unknown) =>
        emit(
          note,
          nodes(),
          edges,
          [
            ["원본", ...a],
            ["트리", ...tree.slice(1)],
          ],
          result,
        );
      for (let i = 0; i < 4; i++) {
        tree[4 + i] = a[i];
        state(`리프 ${i}에 ${a[i]} 저장`);
      }
      for (let i = 3; i > 0; i--) {
        tree[i] = tree[i * 2] + tree[i * 2 + 1];
        state(`노드 ${i}: 두 자식 합 ${tree[i]}`);
      }
      a[1] = 6;
      tree[5] = 6;
      state("인덱스 1을 6으로 변경");
      for (let i = 2; i > 0; i = Math.floor(i / 2)) {
        tree[i] = tree[i * 2] + tree[i * 2 + 1];
        state(`조상 ${i} 다시 계산`);
      }
      let l = 5,
        r = 7,
        sum = 0;
      while (l <= r) {
        if (l % 2 === 1) {
          sum += tree[l];
          state(`왼쪽 경계 노드 ${l}의 합 ${tree[l]} 사용`);
          l++;
        }
        if (r % 2 === 0) {
          sum += tree[r];
          state(`오른쪽 경계 노드 ${r}의 합 ${tree[r]} 사용`);
          r--;
        }
        l = Math.floor(l / 2);
        r = Math.floor(r / 2);
      }
      state(`[1,3] 합 = ${sum}`, { sum, a, tree });
    } else {
      const bit = Array(5).fill(0);
      const state = (note: string, active = -1, result?: unknown) =>
        emit(
          note,
          bit
            .slice(1)
            .map((v, i) =>
              card(String(i + 1), String(v), i, `[${i + 1}]`, i + 1 === active),
            ),
          [],
          [
            ["원본", ...a],
            ["BIT", ...bit.slice(1)],
          ],
          result,
        );
      const add = (i: number, delta: number) => {
        for (; i <= 4; i += i & -i) {
          bit[i] += delta;
          state(`BIT[${i}] += ${delta}, 다음은 i + lowbit(i)`, i);
        }
      };
      state("BIT를 0으로 초기화");
      a.forEach((x, i) => add(i + 1, x));
      const delta = 6 - a[1];
      a[1] = 6;
      add(2, delta);
      const prefix = (i: number) => {
        let sum = 0;
        for (; i > 0; i -= i & -i) {
          sum += bit[i];
          state(`prefix: BIT[${i}] 누적 → ${sum}`, i);
        }
        return sum;
      };
      const sum = prefix(4) - prefix(1);
      state(`[2,4] 합 = ${sum}`, -1, { sum, a, bit });
    }
  } else if (topic === "trie") {
    const words =
      variant === 0
        ? ["cat", "car", "dog"]
        : variant === 1
          ? ["a", "ab", "abc"]
          : ["tea", "tea", "ten"];
    title = ["접두사 공유", "단어가 다른 단어의 접두사", "중복 단어"][variant];
    description = `${words.join(", ")}를 삽입합니다. ★는 완성된 단어의 끝이며 경로가 존재하는 것과 단어가 존재하는 것은 다릅니다.`;
    complexity = "길이 L인 단어 삽입·검색 O(L), 공간 O(총 문자 수).";
    const nodes = [{ char: "root", parent: -1, terminal: false, depth: 0 }],
      children: Record<string, number> = {};
    const state = (note: string, active = -1, result?: unknown) =>
      emit(
        note,
        nodes.map((x, i) => ({
          id: String(i),
          label: x.char + (x.terminal ? "★" : ""),
          x:
            70 +
            nodes.slice(0, i).filter((n) => n.depth === x.depth).length * 130,
          y: 60 + x.depth * 110,
          state: i === active ? "active" : "",
        })),
        nodes.flatMap((x, i) =>
          x.parent < 0
            ? []
            : [{ from: String(x.parent), to: String(i), directed: true }],
        ),
        nodes.map((x, i) => [i, x.char, x.terminal ? "단어 끝" : "접두사"]),
        result,
      );
    state("루트 생성");
    for (const word of words) {
      let u = 0;
      for (const c of word) {
        const key = `${u}:${c}`;
        if (children[key] === undefined) {
          children[key] = nodes.length;
          nodes.push({
            char: c,
            parent: u,
            terminal: false,
            depth: nodes[u].depth + 1,
          });
        }
        u = children[key];
        state(`${word}: 문자 ${c}로 이동`, u);
      }
      nodes[u].terminal = true;
      state(`${word}의 끝 표시`, u);
    }
    state("삽입 완료", -1, {
      words: [...new Set(words)],
      nodeCount: nodes.length,
    });
  } else if (topic === "kmp") {
    const text = ["abababacaba", "aaaaa", "abcdef"][variant],
      pattern = ["abaca", "aaa", "gh"][variant];
    title = ["실패 후 접두사 재사용", "겹치는 일치", "일치 없음"][variant];
    description = `텍스트 ${text}, 패턴 ${pattern}. LPS를 만든 뒤 불일치 시 패턴 위치만 되돌립니다.`;
    complexity = "시간 O(N+M), 추가 공간 O(M).";
    const lps = Array(pattern.length).fill(0),
      matches: number[] = [];
    const state = (note: string, i = -1, j = -1, result?: unknown) =>
      emit(
        note,
        [...text]
          .map((c, k) => card(`t${k}`, c, k, `text[${k}]`, k === i))
          .concat(
            [...pattern].map((c, k) => ({
              ...card(`p${k}`, c, k, `pattern[${k}]`, k === j),
              y: 320 + Math.floor(k / 5) * 110,
            })),
          ),
        [],
        [
          ["LPS", ...lps],
          ["일치 시작", matches.join(", ")],
        ],
        result,
      );
    state("접두사 테이블 초기화");
    for (let i = 1, len = 0; i < pattern.length;) {
      if (pattern[i] === pattern[len]) {
        lps[i++] = ++len;
        state("접두사와 접미사 일치 길이 증가");
      } else if (len) {
        len = lps[len - 1];
        state(`LPS 구성: 길이 ${len}으로 후퇴`);
      } else {
        i++;
        state("일치 접두사 없음");
      }
    }
    for (let i = 0, j = 0; i < text.length;) {
      state(`텍스트 ${i}, 패턴 ${j} 비교`, i, j);
      if (text[i] === pattern[j]) {
        i++;
        j++;
        if (j === pattern.length) {
          matches.push(i - j);
          state(`시작 위치 ${i - j}에서 일치`, i - 1, j - 1);
          j = lps[j - 1];
        }
      } else if (j) {
        j = lps[j - 1];
        state(`불일치: 패턴 위치를 ${j}로 후퇴`, i, j);
      } else i++;
    }
    state("검색 완료", -1, -1, { matches, lps });
  } else if (topic === "balanced-tree") {
    const values =
      variant === 0
        ? [30, 20, 10]
        : variant === 1
          ? [10, 30, 20]
          : [30, 10, 20, 40, 50];
    title = ["LL: 오른쪽 회전", "RL: 이중 회전", "LR과 추가 삽입"][variant];
    description =
      "AVL 트리의 실제 삽입 예제입니다. 균형 인수 = 왼쪽 높이 − 오른쪽 높이이며 절댓값 2에서 회전합니다.";
    complexity =
      "삽입·검색 O(log n), 공간 O(n). 레드블랙 트리 대신 AVL을 대표 구현합니다.";
    type Node = { v: number; l: Node | null; r: Node | null; height: number };
    let root: Node | null = null;
    const h = (x: Node | null): number => x?.height ?? 0;
    const update = (x: Node) => {
      x.height = 1 + Math.max(h(x.l), h(x.r));
    };
    const state = (note: string, result?: unknown) => {
      const nodes: DiagramNode[] = [],
        edges: DiagramEdge[] = [];
      let index = 0;
      const walk = (x: Node | null, depth: number) => {
        if (!x) return;
        walk(x.l, depth + 1);
        nodes.push({
          id: String(x.v),
          label: String(x.v),
          detail: `h=${h(x)}, b=${h(x.l) - h(x.r)}`,
          x: 80 + index++ * 115,
          y: 60 + depth * 120,
        });
        for (const c of [x.l, x.r])
          if (c) edges.push({ from: String(x.v), to: String(c.v) });
        walk(x.r, depth + 1);
      };
      walk(root, 0);
      emit(
        note,
        nodes,
        edges,
        nodes.map((n) => [n.label, n.detail!]),
        result,
      );
    };
    const rr = (y: Node) => {
        const x = y.l!;
        y.l = x.r;
        x.r = y;
        update(y);
        update(x);
        return x;
      },
      ll = (x: Node) => {
        const y = x.r!;
        x.r = y.l;
        y.l = x;
        update(x);
        update(y);
        return y;
      };
    const events: string[] = [];
    const insert = (x: Node | null, v: number): Node => {
      if (!x) return { v, l: null, r: null, height: 1 };
      if (v < x.v) x.l = insert(x.l, v);
      else if (v > x.v) x.r = insert(x.r, v);
      else return x;
      update(x);
      const b = h(x.l) - h(x.r);
      if (b > 1) {
        if (v > x.l!.v) {
          x.l = ll(x.l!);
          events.push(`${x.v}: LR의 왼쪽 회전`);
        }
        events.push(`${x.v}: 오른쪽 회전`);
        return rr(x);
      }
      if (b < -1) {
        if (v < x.r!.v) {
          x.r = rr(x.r!);
          events.push(`${x.v}: RL의 오른쪽 회전`);
        }
        events.push(`${x.v}: 왼쪽 회전`);
        return ll(x);
      }
      return x;
    };
    state("빈 AVL 트리");
    for (const v of values) {
      events.length = 0;
      root = insert(root, v);
      state(
        `${v} 삽입${events.length ? " · " + events.join(" → ") : " · 회전 불필요"}`,
      );
    }
    state("모든 노드의 균형 인수는 -1, 0, 1입니다.", { root });
  } else if (topic === "lca") {
    title = ["다른 서브트리", "조상과 자손", "같은 정점"][variant];
    description =
      "루트 0, 부모 배열 [-1,0,0,1,1,2,2]입니다. 이진 리프팅으로 깊이를 맞추고 두 정점을 함께 올립니다.";
    complexity = "전처리 O(N log N), 질의 O(log N), 공간 O(N log N).";
    const parent = [0, 0, 0, 1, 1, 2, 2],
      depth = [0, 1, 1, 2, 2, 2, 2],
      up = parent.map((p) => [p, 0, 0]);
    let [u, v] = variant === 0 ? [3, 6] : variant === 1 ? [1, 4] : [5, 5];
    const state = (note: string, result?: unknown) =>
      emit(
        note,
        parent.map((p, i) => ({
          id: String(i),
          label: String(i),
          detail: `깊이 ${depth[i]}`,
          x: [350, 190, 510, 100, 270, 440, 610][i],
          y: 60 + depth[i] * 120,
          state: i === u || i === v ? "active" : "",
        })),
        parent.slice(1).map((p, i) => ({ from: String(p), to: String(i + 1) })),
        [
          ["정점", "2⁰ 조상", "2¹ 조상", "2² 조상"],
          ...up.map((r, i) => [i, ...r]),
        ],
        result,
      );
    state("2⁰ 조상(직접 부모) 초기화");
    for (let k = 1; k < 3; k++) {
      for (let vertex = 0; vertex < 7; vertex++)
        up[vertex][k] = up[up[vertex][k - 1]][k - 1];
      state(`2^${k} 조상 = 2^${k - 1} 조상의 2^${k - 1} 조상`);
    }
    state(`${u}, ${v}의 LCA 질의 · 조상 표 구성 완료`);
    if (depth[u] < depth[v]) [u, v] = [v, u];
    let diff = depth[u] - depth[v];
    for (let k = 2; k >= 0; k--)
      if (diff & (1 << k)) {
        u = up[u][k];
        state(`깊이 차이를 줄이기 위해 2^${k}칸 상승`);
      }
    if (u !== v) {
      for (let k = 2; k >= 0; k--)
        if (up[u][k] !== up[v][k]) {
          u = up[u][k];
          v = up[v][k];
          state(`서로 다른 조상으로 2^${k}칸 상승`);
        }
      u = parent[u];
    }
    state(`최소 공통 조상은 ${u}`, { lca: u, up });
  } else if (topic === "advanced-dp") {
    const a =
        variant === 0
          ? [1, 2, 3, 4, 5, 6]
          : variant === 1
            ? [0, 0, 2, 2, 5, 5]
            : [6, 5, 4, 3, 2, 1],
      n = a.length,
      kmax = 3;
    title = ["연속 구간 분할", "0과 중복 값", "내림차순 가중치"][variant];
    description =
      "비음수 배열을 3개 연속 구간으로 나누어 각 구간 합의 제곱 합을 최소화합니다. 이 비용의 Monge 성질과 최적 분할점 단조성을 이용하는 분할 정복 DP입니다.";
    complexity =
      "단계당 O(N log N), 총 O(KN log N), 공간 O(KN). 다른 DP에 적용하려면 단조성 증명이 필요합니다.";
    const prefix = [0];
    a.forEach((x) => prefix.push(prefix.at(-1)! + x));
    const dp = Array.from({ length: kmax + 1 }, () =>
        Array(n + 1).fill(Infinity),
      ),
      opt = Array.from({ length: kmax + 1 }, () => Array(n + 1).fill(-1));
    dp[0][0] = 0;
    const state = (note: string, mid = -1, result?: unknown) =>
      emit(
        note,
        a.map((x, i) => card(String(i), String(x), i, `[${i}]`, i + 1 === mid)),
        [],
        [
          ["k / 길이", ...Array.from({ length: n + 1 }, (_, i) => i)],
          ...dp.map((r, k) => [k, ...r.map(show)]),
          ["분할점 k=3", ...opt[3]],
        ],
        result,
      );
    state("dp[k][i] = min(dp[k−1][j] + (prefix[i]−prefix[j])²)");
    for (let k = 1; k <= kmax; k++) {
      const solve = (l: number, r: number, lo: number, hi: number) => {
        if (l > r) return;
        const m = (l + r) >> 1;
        let best = lo;
        for (let j = lo; j <= Math.min(m - 1, hi); j++) {
          const cost = dp[k - 1][j] + (prefix[m] - prefix[j]) ** 2;
          if (cost < dp[k][m]) {
            dp[k][m] = cost;
            best = j;
          }
        }
        opt[k][m] = best;
        state(
          `k=${k}, i=${m}: 후보 [${lo},${Math.min(m - 1, hi)}], 최적 j=${best}`,
          m,
        );
        solve(l, m - 1, lo, best);
        solve(m + 1, r, best, hi);
      };
      solve(k, n, k - 1, n - 1);
    }
    state(`최소 비용 ${dp[kmax][n]}`, -1, { cost: dp[kmax][n], dp, opt, a });
  } else if (topic === "geometry") {
    const points =
      variant === 0
        ? [
            [0, 0],
            [4, 0],
            [4, 3],
            [0, 3],
            [2, 1],
          ]
        : variant === 1
          ? [
              [0, 0],
              [1, 1],
              [2, 2],
              [3, 3],
            ]
          : [
              [0, 0],
              [0, 0],
              [3, 0],
              [1, 3],
              [1, 1],
            ];
    title = ["내부 점 제외", "일직선의 점", "중복 점"][variant];
    description =
      "Andrew 단조 체인으로 볼록 껍질을 구합니다. 외적 ≤ 0이면 직선 위 중간 점과 시계 방향 굴곡을 제거합니다. 점의 드래그는 화면 위치만 바꿉니다.";
    complexity = "정렬 O(N log N), 스캔 O(N), 공간 O(N).";
    const p = [...new Map(points.map((x) => [x.join(","), x])).values()].sort(
      (a, b) => a[0] - b[0] || a[1] - b[1],
    );
    const lower: number[] = [],
      upper: number[] = [];
    const cross = (a: number[], b: number[], c: number[]) =>
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const state = (
      note: string,
      chain: number[],
      closed = false,
      result?: unknown,
    ) =>
      emit(
        note,
        p.map((v, i) => ({
          id: String(i),
          label: String(i),
          detail: `(${v})`,
          x: 80 + v[0] * 130,
          y: 450 - v[1] * 110,
          state: chain.includes(i) ? "active" : "",
        })),
        chain
          .slice(1)
          .map((v, i) => ({ from: String(chain[i]), to: String(v) }))
          .concat(
            closed && chain.length > 2
              ? [{ from: String(chain.at(-1)), to: String(chain[0]) }]
              : [],
          ),
        p.map((v, i) => [i, ...v]),
        result,
      );
    state("중복 제거 후 x, y 오름차순 정렬", []);
    for (const [chain, indices, name] of [
      [lower, p.map((_, i) => i), "아래"],
      [upper, p.map((_, i) => i).reverse(), "위"],
    ] as [number[], number[], string][]) {
      for (const i of indices) {
        while (
          chain.length >= 2 &&
          cross(p[chain.at(-2)!], p[chain.at(-1)!], p[i]) <= 0
        ) {
          const removed = chain.pop();
          state(`${name} 껍질: 점 ${removed} 제거 (외적 ≤ 0)`, chain);
        }
        chain.push(i);
        state(`${name} 껍질에 점 ${i} 추가`, chain);
      }
    }
    const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
    state("볼록 껍질 완성", hull, true, { hull: hull.map((i) => p[i]) });
  } else if (topic === "fft") {
    const a = variant === 0 ? [1, 2, 3] : variant === 1 ? [1, -1] : [0, 2],
      b = variant === 0 ? [4, 5] : variant === 1 ? [1, 1] : [0, 3];
    title = ["다항식 곱셈", "음수 계수 상쇄", "0인 상수항"][variant];
    description = `낮은 차수부터 계수 A=[${a}], B=[${b}]입니다. radix-2 FFT → 점별 곱 → 역 FFT를 실제 계산합니다. 반올림 전 복소수 오차는 표시 자릿수로 줄입니다.`;
    complexity =
      "시간 O(N log N), 공간 O(N), N은 결과 길이 이상인 2의 거듭제곱.";
    type C = [number, number];
    let n = 1;
    while (n < a.length + b.length - 1) n *= 2;
    const mul = (x: C, y: C): C => [
      x[0] * y[0] - x[1] * y[1],
      x[0] * y[1] + x[1] * y[0],
    ];
    const fmt = (x: C) =>
      `${Number(x[0].toFixed(3))}${x[1] < 0 ? "" : "+"}${Number(x[1].toFixed(3))}i`;
    const state = (note: string, x: C[], result?: unknown) =>
      emit(
        note,
        x.map((v, i) => card(String(i), fmt(v), i, `[${i}]`)),
        [],
        x.map((v, i) => [i, ...v.map((y) => Number(y.toFixed(6)))]),
        result,
      );
    const fft = (x: C[], inverse: boolean, label: string) => {
      for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) [x[i], x[j]] = [x[j], x[i]];
      }
      state(`${label}: 비트 반전 순열`, x);
      for (let len = 2; len <= n; len *= 2) {
        const angle = ((inverse ? 2 : -2) * Math.PI) / len;
        for (let i = 0; i < n; i += len)
          for (let j = 0; j < len / 2; j++) {
            const u = x[i + j],
              v = mul(x[i + j + len / 2], [
                Math.cos(angle * j),
                Math.sin(angle * j),
              ]);
            x[i + j] = [u[0] + v[0], u[1] + v[1]];
            x[i + j + len / 2] = [u[0] - v[0], u[1] - v[1]];
            state(
              `${label}: 크기 ${len}, ${i + j}↔${i + j + len / 2} 버터플라이`,
              x,
            );
          }
      }
      if (inverse) {
        x.forEach((v) => {
          v[0] /= n;
          v[1] /= n;
        });
        state("역변환: N으로 나누기", x);
      }
      return x;
    };
    const x = Array.from({ length: n }, (_, i): C => [a[i] ?? 0, 0]),
      y = Array.from({ length: n }, (_, i): C => [b[i] ?? 0, 0]);
    state("A를 0으로 패딩", x);
    fft(x, false, "A FFT");
    state("B를 0으로 패딩", y);
    fft(y, false, "B FFT");
    const product = x.map((v, i) => mul(v, y[i]));
    state("주파수별 점 곱", product);
    fft(product, true, "역 FFT");
    const coefficients = product
      .slice(0, a.length + b.length - 1)
      .map((v) => Math.round(v[0]));
    state(`곱의 계수 [${coefficients}]`, product, { coefficients, a, b });
  }
  return { title, description, complexity, frames };
}
