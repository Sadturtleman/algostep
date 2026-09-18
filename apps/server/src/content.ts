import type { DB } from "./db.js";
export const languages = ["python", "cpp", "java"] as const;
const pyBinary = `n = int(input())\na = list(map(int, input().split()))\ntarget = int(input())\nleft, right = 0, n - 1\nanswer = -1\nwhile left <= right:\n    mid = (left + right) // 2\n    if a[mid] == target:\n        answer = mid\n        break\n    if a[mid] < target:\n        left = mid + 1\n    else:\n        right = mid - 1\nprint(answer)\n`;
const cppBinary = `#include <iostream>\n#include <vector>\nusing namespace std;\nint main() {\n    int n, target; cin >> n; vector<int> a(n);\n    for (auto &x : a) cin >> x;\n    cin >> target; int left=0, right=n-1, answer=-1;\n    while (left<=right) {\n        int mid=left+(right-left)/2;\n        if(a[mid]==target) { answer=mid; break; }\n        if(a[mid]<target) left=mid+1; else right=mid-1;\n    }\n    cout << answer << '\\n';\n}\n`;
const javaBinary = `import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc=new Scanner(System.in);\n        int n=sc.nextInt(); int[] a=new int[n];\n        for(int i=0;i<n;i++) a[i]=sc.nextInt();\n        int target=sc.nextInt(), left=0, right=n-1, answer=-1;\n        while(left<=right) {\n            int mid=left+(right-left)/2;\n            if(a[mid]==target) { answer=mid; break; }\n            if(a[mid]<target) left=mid+1; else right=mid-1;\n        }\n        System.out.println(answer);\n    }\n}\n`;
const pyBfs = `from collections import deque\nn, m = map(int, input().split())\ngraph = [[] for _ in range(n)]\nfor _ in range(m):\n    a, b = map(int, input().split())\n    graph[a].append(b)\n    graph[b].append(a)\nfor neighbors in graph:\n    neighbors.sort()\nstart = int(input())\nqueue = deque([start])\nvisited = [False] * n\nvisited[start] = True\norder = []\nwhile queue:\n    current = queue.popleft()\n    order.append(current)\n    for neighbor in graph[current]:\n        if not visited[neighbor]:\n            visited[neighbor] = True\n            queue.append(neighbor)\nprint(*order)\n`;
const cppBfs = `#include <iostream>\n#include <vector>\n#include <queue>\n#include <algorithm>\nusing namespace std;\nint main(){int n,m;cin>>n>>m;vector<vector<int>> graph(n);\nfor(int i=0,a,b;i<m;i++){cin>>a>>b;graph[a].push_back(b);graph[b].push_back(a);}\nfor(auto &v:graph)sort(v.begin(),v.end());\nint s;cin>>s;queue<int> q;vector<bool> seen(n);q.push(s);seen[s]=true;bool first=true;\nwhile(!q.empty()){int v=q.front();q.pop();if(!first)cout<<' ';first=false;cout<<v;\nfor(int w:graph[v])if(!seen[w]){seen[w]=true;q.push(w);}}cout<<'\\n';}\n`;
const javaBfs = `import java.util.*;\npublic class Main { public static void main(String[] args){\nScanner sc=new Scanner(System.in);int n=sc.nextInt(),m=sc.nextInt();\nList<List<Integer>> g=new ArrayList<>();for(int i=0;i<n;i++)g.add(new ArrayList<>());\nfor(int i=0;i<m;i++){int a=sc.nextInt(),b=sc.nextInt();g.get(a).add(b);g.get(b).add(a);}\nfor(List<Integer> v:g)Collections.sort(v);\nint s=sc.nextInt();boolean[] seen=new boolean[n];Deque<Integer> q=new ArrayDeque<>();q.add(s);seen[s]=true;\nStringJoiner out=new StringJoiner(" ");while(!q.isEmpty()){int v=q.remove();out.add(""+v);for(int w:g.get(v))if(!seen[w]){seen[w]=true;q.add(w);}}\nSystem.out.println(out);}}\n`;
const pyTree = `n = int(input())\nvalues = list(map(int, input().split()))\norder = []\ndef inorder(index):\n    if index >= n:\n        return\n    inorder(2 * index + 1)\n    order.append(values[index])\n    inorder(2 * index + 2)\ninorder(0)\nprint(*order)\n`;
const cppTree = `#include <iostream>\n#include <vector>\nusing namespace std;\nvector<int> a,order;\nvoid inorder(int i){if(i>=(int)a.size())return;inorder(i*2+1);order.push_back(a[i]);inorder(i*2+2);}\nint main(){int n;cin>>n;a.resize(n);for(int &x:a)cin>>x;inorder(0);for(int i=0;i<(int)order.size();i++){if(i)cout<<' ';cout<<order[i];}cout<<'\\n';}\n`;
const javaTree = `import java.util.*;\npublic class Main {static int[] a;static StringJoiner out=new StringJoiner(" ");\nstatic void inorder(int i){if(i>=a.length)return;inorder(i*2+1);out.add(""+a[i]);inorder(i*2+2);}\npublic static void main(String[] args){Scanner sc=new Scanner(System.in);int n=sc.nextInt();a=new int[n];for(int i=0;i<n;i++)a[i]=sc.nextInt();inorder(0);System.out.println(out);}}\n`;
const topics = [
  [
    "binary-search",
    "이진 탐색",
    "탐색",
    "P0",
    "정렬된 배열에서 탐색 구간의 중간 값을 확인합니다. 목표보다 작으면 왼쪽 절반을 제외하고, 크면 오른쪽 절반을 제외합니다. 매 단계 left ≤ right를 확인하고 mid와 경계를 갱신하세요. 빈 구간이 되면 찾지 못한 것입니다. 입력을 읽고 배열을 저장하는 전체 프로그램은 O(n) 시간과 O(n) 공간을 사용하며, 탐색 자체는 O(log n) 시간과 O(1) 추가 공간입니다.",
    "O(n)|O(n)",
    "이진 탐색의 전제 조건은 무엇일까요?",
    ["배열이 정렬되어 있다", "모든 값이 짝수다", "항상 원소가 8개다"],
    0,
    "정렬되어 있어야 중간 값과 비교해서 절반을 안전하게 제외할 수 있어요.",
  ],
  [
    "bfs",
    "너비 우선 탐색",
    "그래프",
    "P0",
    "BFS는 시작 정점과 가까운 정점부터 방문합니다. 큐에 넣는 시점에 방문 표시를 해야 같은 정점이 여러 번 들어가지 않습니다. 인접 리스트 순서가 탐색 결과를 결정합니다. 정렬된 인접 리스트가 주어지면 O(V+E) 시간이 걸립니다. 이 문제의 전체 프로그램은 인접 리스트 정렬까지 포함하므로 O(V+E log E)가 상한입니다.",
    "O(V + E log E)|O(V + E)",
    "방문 표시는 언제 하는 것이 좋을까요?",
    ["큐에서 뺀 다음만", "큐에 넣을 때", "모든 탐색이 끝난 뒤"],
    1,
    "큐에 넣을 때 표시하면 중복 삽입을 막을 수 있어요.",
  ],
  [
    "tree",
    "이진 트리 순회",
    "자료구조",
    "P0",
    "이진 트리는 각 노드가 최대 두 자식을 가지는 구조입니다. 중위 순회는 왼쪽 자식, 현재 노드, 오른쪽 자식 순으로 방문합니다. 배열 표현에서는 인덱스 i의 자식이 2i+1과 2i+2입니다. 재귀 호출 스택을 따라가며 방문 순서를 살펴보세요. 전체 출력 배열을 저장하는 프로그램의 공간은 O(n)입니다.",
    "O(n)|O(n)",
    "중위 순회의 방문 순서는?",
    ["현재 → 왼쪽 → 오른쪽", "왼쪽 → 현재 → 오른쪽", "왼쪽 → 오른쪽 → 현재"],
    1,
    "중위 순회는 왼쪽 서브트리, 현재 노드, 오른쪽 서브트리 순입니다.",
  ],
  [
    "stack",
    "스택",
    "자료구조",
    "P0",
    "스택은 마지막에 넣은 데이터를 먼저 꺼냅니다. push로 추가하고 pop으로 제거합니다. 괄호 검사와 함수 호출에 쓰입니다. 비어 있는 스택에서 pop하지 않도록 확인하세요.",
    "O(n)|O(n)",
    "스택에서 먼저 나오는 값은?",
    ["가장 먼저 넣은 값", "가장 나중에 넣은 값", "가장 작은 값"],
    1,
    "스택은 LIFO 구조입니다.",
  ],
  [
    "queue",
    "큐",
    "자료구조",
    "P0",
    "큐는 먼저 넣은 데이터를 먼저 꺼냅니다. 작업 대기열과 BFS에 사용합니다. Python에서는 리스트 앞에서 제거하는 대신 collections.deque의 popleft를 사용하면 효율적입니다.",
    "O(n)|O(n)",
    "큐에 1, 2, 3을 넣으면 먼저 나오는 값은?",
    ["3", "2", "1"],
    2,
    "큐는 FIFO 구조입니다.",
  ],
  [
    "array",
    "배열과 문자열",
    "자료구조",
    "P0",
    "배열의 인덱스 접근은 O(1)입니다. 중간 삽입·삭제는 뒤의 원소를 이동시켜 O(n)이 걸릴 수 있습니다. 문자열의 불변성과 언어별 인덱스 규칙에 주의하세요.",
    "O(n)|O(n)",
    "배열 중간 원소를 삭제할 때 비용이 커지는 이유는?",
    ["원소 이동이 필요해서", "항상 정렬해서", "재귀가 필요해서"],
    0,
    "연속된 배열에서는 뒤 원소를 이동해야 합니다.",
  ],
  [
    "hash",
    "해시 테이블",
    "자료구조",
    "P0",
    "키를 해시 값으로 바꾸어 값을 저장합니다. 충돌은 체이닝 같은 방식으로 처리합니다. 조회는 평균 O(1)이지만 충돌 상황에서는 O(n)이 될 수 있습니다.",
    "O(n)|O(n)",
    "해시 충돌은 무엇일까요?",
    ["두 키의 저장 위치가 겹침", "키가 사라짐", "배열이 정렬됨"],
    0,
    "서로 다른 키가 같은 버킷에 대응하면 충돌입니다.",
  ],
  [
    "dp",
    "동적 계획법",
    "알고리즘",
    "P0",
    "중복되는 부분 문제의 답을 저장해 다시 계산하지 않습니다. 상태 정의, 초기값, 점화식, 계산 순서를 차례로 정하세요. 피보나치 수열은 직전 두 값만 유지해 공간을 줄일 수 있습니다.",
    "문제별 상이|문제별 상이",
    "동적 계획법이 줄이는 작업은?",
    ["중복 부분 문제 계산", "입력 읽기", "출력 형식 검사"],
    0,
    "이미 구한 부분 문제의 답을 재사용합니다.",
  ],
  [
    "sorting",
    "정렬",
    "알고리즘",
    "P0",
    "정렬은 데이터를 기준에 따라 배치합니다. 병합 정렬은 분할 후 병합하며 O(n log n) 시간을 보장합니다. 퀵 정렬은 피벗 선택에 따라 최악 O(n²)이 될 수 있습니다.",
    "알고리즘별 상이|알고리즘별 상이",
    "퀵 정렬의 최악 시간 복잡도는?",
    ["O(1)", "O(n)", "O(n²)"],
    2,
    "매번 한쪽으로 치우쳐 분할되면 제곱 시간이 걸립니다.",
  ],
  [
    "two-pointer",
    "투 포인터",
    "알고리즘",
    "P0",
    "두 인덱스의 이동 조건을 이용해 탐색 범위를 줄입니다. 정렬된 배열에서 합을 찾는 경우 현재 합이 작으면 왼쪽 포인터를, 크면 오른쪽 포인터를 이동합니다.",
    "O(n)|O(1)",
    "정렬된 배열의 양끝 합이 목표보다 작으면?",
    ["왼쪽 포인터 증가", "오른쪽 포인터 감소", "배열 뒤집기"],
    0,
    "작은 값을 늘려 합을 크게 만듭니다.",
  ],
  [
    "union-find",
    "유니온 파인드",
    "자료구조",
    "P1",
    "서로소 집합을 관리합니다. find는 대표를 찾고 union은 두 집합을 합칩니다. 경로 압축과 크기 기반 합치기로 효율을 높입니다.",
    "O(m α(n))|O(n)",
    "find 연산이 구하는 것은?",
    ["집합의 대표", "최대 값", "최단 거리"],
    0,
    "원소가 속한 집합의 대표를 찾습니다.",
  ],
  [
    "flow",
    "최대 유량",
    "그래프",
    "P2",
    "간선 용량이 있는 그래프에서 시작점에서 도착점까지 보낼 수 있는 최대 흐름을 구합니다. 잔여 그래프에는 흐름을 되돌리는 역방향 간선도 필요합니다.",
    "알고리즘별 상이|O(V + E)",
    "잔여 그래프에 역방향 간선을 두는 이유는?",
    ["기존 흐름을 조정하려고", "정렬하려고", "정점을 삭제하려고"],
    0,
    "이전 선택을 되돌려 더 좋은 경로로 유량을 재배치할 수 있습니다.",
  ],
] as const;
const starters = {
  python: "# 전체 프로그램을 작성하세요.\n",
  cpp: "#include <iostream>\nusing namespace std;\nint main() {\n    return 0;\n}\n",
  java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n    }\n}\n",
};
const problems = [
  {
    id: "binary-search-v1",
    topic: "binary-search",
    title: "정렬된 배열에서 값 찾기",
    statement:
      "오름차순으로 정렬된 서로 다른 정수 배열에서 target의 0부터 시작하는 인덱스를 출력하세요. 없으면 -1을 출력합니다.",
    input: "첫 줄 n, 둘째 줄 n개의 정수, 셋째 줄 target",
    output: "인덱스 또는 -1 뒤에 줄바꿈",
    constraints: "1 ≤ n ≤ 100000, 각 정수의 절댓값 ≤ 10⁹",
    tests: [
      { input: "7\n2 5 8 13 21 34 55\n21\n", expected: "4\n" },
      { input: "3\n1 3 5\n2\n", expected: "-1\n" },
      { input: "1\n9\n9\n", expected: "0\n" },
    ],
    refs: { python: pyBinary, cpp: cppBinary, java: javaBinary },
  },
  {
    id: "bfs-v1",
    topic: "bfs",
    title: "그래프를 가까운 순서로 탐색하기",
    statement:
      "무방향 그래프에서 시작 정점으로부터 BFS로 방문한 정점을 출력하세요. 인접 정점은 번호가 작은 순서로 확인합니다. 도달할 수 없는 정점은 출력하지 않습니다.",
    input: "n m, 다음 m줄 간선 u v, 마지막 줄 시작 정점",
    output: "방문한 정점을 공백 하나로 구분하고 마지막에 줄바꿈",
    constraints: "1 ≤ n ≤ 1000, 0 ≤ m ≤ 5000, 0 ≤ 정점 번호 < n",
    tests: [
      {
        input: "6 6\n0 1\n0 2\n1 3\n1 4\n2 4\n4 5\n0\n",
        expected: "0 1 2 3 4 5\n",
      },
      { input: "3 1\n0 1\n2\n", expected: "2\n" },
    ],
    refs: { python: pyBfs, cpp: cppBfs, java: javaBfs },
  },
  {
    id: "tree-v1",
    topic: "tree",
    title: "이진 트리를 중위 순회하기",
    statement:
      "레벨 순서의 배열로 주어진 완전 이진 트리를 중위 순회한 값을 출력하세요. 인덱스 i의 자식은 2i+1, 2i+2입니다.",
    input: "첫 줄 노드 수 n, 둘째 줄 레벨 순서의 n개 정수",
    output: "중위 순회 결과를 공백 하나로 구분하고 마지막에 줄바꿈",
    constraints: "1 ≤ n ≤ 1000",
    tests: [
      { input: "7\n8 4 12 2 6 10 14\n", expected: "2 4 6 8 10 12 14\n" },
      { input: "1\n42\n", expected: "42\n" },
    ],
    refs: { python: pyTree, cpp: cppTree, java: javaTree },
  },
];
export async function seed(db: DB) {
  await db.tx(async (tx) => {
    for (const [
      key,
      title,
      category,
      priority,
      body,
      complexity,
      question,
      options,
      answer,
      explanation,
    ] of topics)
      await tx.query(
        "INSERT INTO topics(id,title,category,priority,body,complexity,quiz) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING",
        [
          key,
          title,
          category,
          priority,
          body,
          complexity,
          JSON.stringify({ question, options, answer, explanation }),
        ],
      );
    for (const p of problems)
      await tx.query(
        "INSERT INTO problems(id,topic_id,version,title,statement,input_spec,output_spec,constraints_text,tests,references_code,starters) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING",
        [
          p.id,
          p.topic,
          p.title,
          p.statement,
          p.input,
          p.output,
          p.constraints,
          JSON.stringify(p.tests),
          JSON.stringify(p.refs),
          JSON.stringify(starters),
        ],
      );
  });
}
