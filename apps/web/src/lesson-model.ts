export type LessonFrame = { vars: Record<string, any>; note: string };
export function lessonFrames(
  topic: string,
  input: number[],
  target = 7,
  graphInput?: number[][],
): LessonFrame[] {
  const a = input.slice(0, 8),
    frames: LessonFrame[] = [];
  const emit = (note: string, vars: Record<string, any> = {}) => {
    if (frames.length < 200)
      frames.push({ note, vars: structuredClone({ a, ...vars }) });
  };
  if (!["bfs", "dfs", "graph-list", "graph-matrix"].includes(topic))
    emit("초기 상태");
  if (["array", "stack", "queue"].includes(topic)) {
    const out: number[] = [];
    for (const x of a) {
      out.push(x);
      emit(`${x} 추가`, { a: out });
    }
    while (out.length) {
      const x = topic === "queue" ? out.shift() : out.pop();
      emit(`${x} 제거`, { a: out });
    }
  } else if (topic === "linked-list") {
    let head: any = null;
    a.forEach((x, i) => {
      head = {
        $id: `node-${i}`,
        $type: "Node",
        fields: { value: x, next: head },
      };
      emit(`${x}를 head 앞에 삽입`, { head, a: [] });
    });
  } else if (topic === "hash") {
    const buckets: number[][] = [[], [], [], []];
    for (const x of a) {
      const b = ((x % 4) + 4) % 4;
      buckets[b].push(x);
      emit(`hash(${x})=${b}: 같은 버킷의 체인에 추가`, { buckets, a: [] });
    }
  } else if (topic === "bst") {
    const tree: any[] = [];
    for (const x of a) {
      if (!tree.length) tree.push({ value: x, left: -1, right: -1 });
      else {
        let i = 0;
        while (true) {
          if (tree[i].value === x) break;
          const k = x < tree[i].value ? "left" : "right";
          if (tree[i][k] < 0) {
            tree[i][k] = tree.length;
            tree.push({ value: x, left: -1, right: -1 });
            break;
          }
          i = tree[i][k];
        }
      }
      const node = (i: number): any =>
        i < 0
          ? null
          : {
              $id: `bst-${i}`,
              $type: "BST",
              fields: {
                value: tree[i].value,
                left: node(tree[i].left),
                right: node(tree[i].right),
              },
            };
      emit(`${x} 삽입 (중복은 생략)`, { root: node(0), a: [] });
    }
  } else if (topic === "heap") {
    const heap: number[] = [];
    for (const x of a) {
      heap.push(x);
      let i = heap.length - 1;
      emit(`${x}를 마지막에 삽입`, { a: heap });
      while (i > 0) {
        const p = Math.floor((i - 1) / 2);
        if (heap[p] <= heap[i]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
        emit("부모와 교환하며 올라가기", { a: heap, mid: i });
      }
    }
  } else if (["bfs", "dfs", "graph-list", "graph-matrix"].includes(topic)) {
    const n = graphInput?.length ?? Math.max(1, a.length),
      graph = graphInput
        ? graphInput.map((row) => [...row])
        : Array.from({ length: n }, () => [] as number[]);
    for (let i = 1; !graphInput && i < n; i++) {
      const p = Math.abs(a[i]) % i;
      graph[p].push(i);
      graph[i].push(p);
    }
    const matrix = graph.map((row) =>
      Array.from({ length: n }, (_, j) => (row.includes(j) ? 1 : 0)),
    );
    const visited = Array(n).fill(false),
      q = [0],
      order: number[] = [];
    visited[0] = true;
    emit("정점 0에서 시작해 도달 가능한 정점을 탐색해요.", {
      graph,
      matrix,
      visited,
      queue: q,
      order,
      a: [],
    });
    while (q.length) {
      const v = topic === "dfs" ? q.pop()! : q.shift()!;
      order.push(v);
      for (const w of graph[v])
        if (!visited[w]) {
          visited[w] = true;
          q.push(w);
        }
      emit(`${v} 방문 후 이웃 추가`, {
        graph,
        matrix,
        visited,
        queue: q,
        order,
        current: v,
        a: [],
      });
    }
  } else if (topic === "tree") {
    const order: number[] = [];
    const visit = (i: number) => {
      if (i >= a.length) return;
      visit(i * 2 + 1);
      order.push(a[i]);
      emit("왼쪽 → 현재 → 오른쪽 중위 순회", { values: a, index: i, order });
      visit(i * 2 + 2);
    };
    visit(0);
  } else if (topic === "binary-search" || topic === "linear-search") {
    if (topic === "binary-search") {
      a.sort((x, y) => x - y);
      emit("이진 탐색을 위해 입력을 오름차순 정렬했어요.");
      let left = 0,
        right = a.length - 1;
      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        emit(`${target}와 중간 값 비교`, { left, right, mid });
        if (a[mid] === target) {
          emit("목표 발견", { answer: mid, left, right, mid });
          return frames;
        }
        if (a[mid] < target) left = mid + 1;
        else right = mid - 1;
      }
    } else
      for (let i = 0; i < a.length; i++) {
        emit(`${i}번 원소와 목표 비교`, { mid: i });
        if (a[i] === target) {
          emit("목표 발견", { answer: i });
          return frames;
        }
      }
    emit("목표 값이 없어요. 반환값은 -1입니다.");
  } else if (
    [
      "sorting",
      "bubble-sort",
      "selection-sort",
      "insertion-sort",
      "merge-sort",
      "quick-sort",
    ].includes(topic)
  ) {
    const swap = (i: number, j: number) => {
      [a[i], a[j]] = [a[j], a[i]];
      emit(`${i}번과 ${j}번 교환`, { left: i, right: j });
    };
    if (topic === "selection-sort")
      for (let i = 0; i < a.length; i++) {
        let k = i;
        for (let j = i + 1; j < a.length; j++) if (a[j] < a[k]) k = j;
        swap(i, k);
      }
    else if (topic === "insertion-sort")
      for (let i = 1; i < a.length; i++) {
        let j = i;
        while (j > 0 && a[j - 1] > a[j]) {
          swap(j - 1, j);
          j--;
        }
      }
    else if (topic === "merge-sort") {
      const merge = (l: number, r: number) => {
        if (r - l < 2) return;
        const m = Math.floor((l + r) / 2);
        merge(l, m);
        merge(m, r);
        const left = a.slice(l, m),
          right = a.slice(m, r);
        let i = 0,
          j = 0,
          k = l;
        while (i < left.length || j < right.length) {
          a[k++] =
            j >= right.length || (i < left.length && left[i] <= right[j])
              ? left[i++]
              : right[j++];
        }
        emit(`[${l},${r}) 병합`, { left: l, right: r - 1 });
      };
      merge(0, a.length);
    } else if (topic === "quick-sort") {
      const quick = (l: number, r: number) => {
        if (l >= r) return;
        const pivot = a[Math.floor((l + r) / 2)];
        let i = l,
          j = r;
        emit(`피벗 ${pivot}로 분할`, { left: l, right: r });
        while (i <= j) {
          while (a[i] < pivot) i++;
          while (a[j] > pivot) j--;
          if (i <= j) swap(i++, j--);
        }
        if (l < j) quick(l, j);
        if (i < r) quick(i, r);
      };
      quick(0, a.length - 1);
    } else
      for (let end = a.length - 1; end > 0; end--)
        for (let j = 0; j < end; j++) if (a[j] > a[j + 1]) swap(j, j + 1);
    emit("정렬 완료");
  } else if (topic === "prefix-sum") {
    const prefix = [0];
    for (let i = 0; i < a.length; i++) {
      prefix.push(prefix[i] + a[i]);
      emit(`prefix[${i + 1}] = ${prefix[i]} + ${a[i]}`, {
        a: prefix,
        mid: i + 1,
      });
    }
  } else if (topic === "sliding-window") {
    const k = Math.min(3, a.length);
    for (let l = 0; l + k <= a.length; l++)
      emit(
        `길이 ${k} 구간의 합 = ${a.slice(l, l + k).reduce((x, y) => x + y, 0)}`,
        { left: l, right: l + k - 1 },
      );
  } else if (topic === "two-pointer") {
    a.sort((x, y) => x - y);
    let l = 0,
      r = a.length - 1;
    emit("정렬 후 양끝 포인터에서 시작");
    while (l < r) {
      const sum = a[l] + a[r];
      emit(`두 값의 합 ${sum}, 목표 ${target}`, { left: l, right: r });
      if (sum === target) {
        emit("목표 합을 찾았어요.", { left: l, right: r });
        return frames;
      }
      if (sum < target) l++;
      else r--;
    }
    emit("조건에 맞는 두 원소가 없어요.");
  } else if (topic === "brute-force") {
    let best = -Infinity;
    for (let i = 0; i < a.length; i++)
      for (let j = i + 1; j < a.length; j++) {
        best = Math.max(best, a[i] + a[j]);
        emit(`모든 쌍의 합 검사: 현재 최댓값 ${best}`, { left: i, right: j });
      }
  } else if (topic === "backtracking") {
    const path: number[] = [];
    const walk = (i: number) => {
      if (i >= Math.min(a.length, 5)) {
        emit(`부분집합 [${path.join(", ")}] 완성`, { a: path });
        return;
      }
      path.push(a[i]);
      emit(`${a[i]} 선택`, { a: path });
      walk(i + 1);
      path.pop();
      emit(`${a[i]} 선택 되돌리기`, { a: path });
      walk(i + 1);
    };
    walk(0);
  } else if (topic === "recursion") {
    const n = Math.max(0, Math.min(6, Math.abs(Math.trunc(target))));
    const stack: string[] = [];
    const fact = (k: number): number => {
      stack.push(`factorial(${k})`);
      emit("호출 스택에 추가", { a: [], stack: [...stack] });
      const result = k < 2 ? 1 : k * fact(k - 1);
      stack.pop();
      emit(`${k}! = ${result} 반환`, { a: [result], stack: [...stack] });
      return result;
    };
    fact(n);
  } else if (["dp", "memoization", "tabulation"].includes(topic)) {
    const n = Math.min(12, Math.abs(Math.trunc(target))),
      dp = [0, 1];
    if (topic === "memoization") {
      const fib = (k: number): number => {
        if (dp[k] !== undefined) {
          emit(`fib(${k}) 캐시 사용`, { a: dp.map((v) => v ?? 0) });
          return dp[k];
        }
        dp[k] = fib(k - 1) + fib(k - 2);
        emit(`fib(${k}) 저장`, { a: dp.map((v) => v ?? 0) });
        return dp[k];
      };
      fib(n);
    } else
      for (let i = 2; i <= n; i++) {
        dp[i] = dp[i - 1] + dp[i - 2];
        emit(`dp[${i}] = dp[${i - 1}] + dp[${i - 2}]`, { a: dp, mid: i });
      }
  } else if (topic === "greedy") {
    let remaining = Math.min(50, Math.max(0, Math.trunc(target)));
    const coins: number[] = [];
    for (const coin of [10, 5, 1])
      while (remaining >= coin) {
        remaining -= coin;
        coins.push(coin);
        emit(
          `동전 ${coin} 선택, 남은 금액 ${remaining}. 이 예제의 동전은 10·5·1입니다.`,
          { a: coins },
        );
      }
  } else return [];
  return frames;
}
