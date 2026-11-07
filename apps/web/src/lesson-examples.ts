export type LessonExample = {
  title: string;
  description: string;
  values: number[];
  target: number;
  graph?: number[][];
};
export function lessonExamples(topic: string): LessonExample[] {
  if (["bfs", "dfs", "graph-list", "graph-matrix"].includes(topic))
    return [
      {
        title: "갈라지는 길",
        description:
          "0에서 시작합니다. BFS의 층별 방문과 DFS의 깊이 우선 순서를 비교해 보세요.",
        values: [0, 0, 0, 1, 1, 2],
        target: 0,
        graph: [[1, 2], [0, 3, 4], [0, 5], [1], [1], [2]],
      },
      {
        title: "사이클과 여러 경로",
        description:
          "같은 정점으로 여러 경로가 이어집니다. 방문 표시가 중복 추가를 막는지 확인하세요.",
        values: [0, 1, 2, 3, 4],
        target: 0,
        graph: [
          [1, 2],
          [0, 2, 3],
          [0, 1, 4],
          [1, 4],
          [2, 3],
        ],
      },
      {
        title: "연결되지 않은 정점",
        description:
          "0에서 도달할 수 없는 3·4·5는 방문하지 않습니다. 그래프 전체와 탐색 범위의 차이를 확인하세요.",
        values: [0, 1, 2, 3, 4, 5],
        target: 0,
        graph: [[1], [0, 2], [1], [4], [3], []],
      },
    ];
  if (["binary-search", "linear-search", "two-pointer"].includes(topic))
    return [
      {
        title: "목표가 있는 입력",
        description:
          "각 단계의 비교 위치와 남은 범위를 따라가세요. 투 포인터에서는 두 수의 합을 찾습니다.",
        values: [2, 5, 8, 13, 21, 34, 55],
        target: 21,
      },
      {
        title: "목표가 없는 입력",
        description: "범위가 비거나 포인터가 만났을 때 종료하는지 살펴보세요.",
        values: [1, 3, 5, 7, 9],
        target: 100,
      },
      {
        title: "하나뿐인 원소",
        description:
          "탐색은 원소 하나도 검사합니다. 두 수 합에서는 서로 다른 두 인덱스가 없어 실패합니다.",
        values: [7],
        target: 7,
      },
    ];
  if (
    [
      "sorting",
      "bubble-sort",
      "selection-sort",
      "insertion-sort",
      "merge-sort",
      "quick-sort",
    ].includes(topic)
  )
    return [
      {
        title: "역순 정렬",
        description:
          "비교와 교환이 자주 일어나는 입력입니다. 확정된 구간이 커지는 과정을 확인하세요.",
        values: [8, 7, 6, 5, 4, 3, 2, 1],
        target: 7,
      },
      {
        title: "음수와 중복",
        description:
          "최종 결과는 [-3,-1,0,2,2,5]입니다. 같은 값이 있어도 알고리즘이 종료되어야 합니다.",
        values: [2, -3, 5, 2, 0, -1],
        target: 7,
      },
      {
        title: "이미 정렬된 입력",
        description:
          "알고리즘마다 불필요한 비교를 줄이는 방식이 어떻게 다른지 살펴보세요.",
        values: [1, 2, 3, 4, 5, 6],
        target: 7,
      },
    ];
  if (["tree", "bst", "heap", "linked-list"].includes(topic))
    return [
      {
        title: "여러 높이의 구조",
        description:
          "삽입이나 순회 시 부모·자식 또는 next 참조가 어떻게 연결되는지 확인하세요.",
        values: [8, 4, 12, 2, 6, 10, 14],
        target: 7,
      },
      {
        title: "오름차순 삽입",
        description:
          "BST는 한쪽으로 치우칠 수 있습니다. 연결 리스트와 힙의 변화도 비교해 보세요.",
        values: [1, 2, 3, 4, 5, 6, 7, 8],
        target: 7,
      },
      {
        title: "루트 하나",
        description: "자식이나 다음 노드가 없는 구조의 종료 조건을 확인하세요.",
        values: [9],
        target: 7,
      },
    ];
  if (["recursion", "dp", "memoization", "tabulation"].includes(topic))
    return [
      {
        title: "크기 5",
        description:
          topic === "recursion"
            ? "5!의 호출과 반환을 추적합니다. 결과는 120입니다."
            : "F(0)=0, F(1)=1인 피보나치 F(5)=5를 구합니다.",
        values: [0, 1],
        target: 5,
      },
      {
        title: "기저 조건 0",
        description:
          topic === "recursion"
            ? "0!=1을 반환하고 더 호출하지 않습니다."
            : "F(0)=0입니다. 초기값만으로 답을 얻는 경우를 확인하세요.",
        values: [0, 1],
        target: 0,
      },
      {
        title: "크기 6",
        description:
          "문제 크기가 하나 늘어날 때 재사용되는 상태와 새로 계산하는 상태를 비교하세요.",
        values: [0, 1],
        target: 6,
      },
    ];
  if (topic === "greedy")
    return [
      {
        title: "28원 만들기",
        description: "동전 10·5·1을 사용하면 10+10+5+1+1+1입니다.",
        values: [10, 5, 1],
        target: 28,
      },
      {
        title: "10원 만들기",
        description:
          "10원 동전 하나로 끝납니다. 선택 후 남은 금액을 확인하세요.",
        values: [10, 5, 1],
        target: 10,
      },
      {
        title: "금액 0",
        description:
          "선택할 동전이 없는 경우입니다. 빈 결과가 올바른 답입니다.",
        values: [10, 5, 1],
        target: 0,
      },
    ];
  return [
    {
      title: "기본 동작",
      description:
        "서로 다른 값을 차례로 처리하며 데이터의 변화 순서를 확인하세요.",
      values: [4, 1, 3, 2],
      target: 7,
    },
    {
      title: "중복과 음수",
      description:
        "값이 같아도 인덱스는 다릅니다. 위치와 값을 구분해 따라가세요.",
      values: [3, -1, 3, 0, 2],
      target: 7,
    },
    {
      title: "작은 입력",
      description:
        "원소가 하나뿐일 때 수행하지 않는 반복과 종료 조건을 확인하세요.",
      values: [5],
      target: 5,
    },
  ];
}
