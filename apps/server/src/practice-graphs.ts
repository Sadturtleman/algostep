import { programs, cases, type PracticeSpec } from "./practice-spec.js";
export const graphPractice: PracticeSpec[] = [];
const pyGraph =
  "n,m=ni(),ni()\ng=[[] for _ in range(n)]\nfor _ in range(m):\n    u,v=ni(),ni();g[u].append(v);g[v].append(u)\nfor row in g: row.sort()\n";
const cppGraph =
  "int n,m;cin>>n>>m;vector<vector<int>> g(n);for(int i=0,u,v;i<m;i++){cin>>u>>v;g[u].push_back(v);g[v].push_back(u);}for(auto &r:g)sort(r.begin(),r.end());";
const javaGraph =
  "int n=sc.nextInt(),m=sc.nextInt();List<List<Integer>> g=new ArrayList<>();for(int i=0;i<n;i++)g.add(new ArrayList<>());for(int i=0;i<m;i++){int u=sc.nextInt(),v=sc.nextInt();g.get(u).add(v);g.get(v).add(u);}for(var r:g)Collections.sort(r);";
graphPractice.push({
  topic: "graph-list",
  title: "정점별 이웃 목록",
  statement:
    "무방향 그래프의 각 정점 번호와 이웃들을 오름차순으로 출력하세요. 고립 정점은 자신의 번호만 출력합니다.",
  input: "n m, 이어서 m개의 간선 u v",
  output: "정점 0부터 n-1까지 한 줄씩 정점 번호와 이웃 번호",
  constraints:
    "1 ≤ n ≤ 100, 0 ≤ m ≤ n(n-1)/2, 정점 번호 0..n-1, 중복 간선·자기 루프 없음",
  time: "O(n + m log n)",
  space: "O(n + m)",
  tests: cases(
    ["3 2\n0 2\n1 2\n", "0 2\n1 2\n2 0 1\n"],
    ["1 0\n", "0\n"],
    ["2 0\n", "0\n1\n"],
  ),
  refs: programs(
    pyGraph + "for u in range(n): print(u,*g[u])",
    cppGraph +
      "for(int u=0;u<n;u++){cout<<u;for(int v:g[u])cout<<' '<<v;cout<<'\\n';}",
    javaGraph +
      'for(int u=0;u<n;u++){StringJoiner o=new StringJoiner(" ");o.add(""+u);for(int v:g.get(u))o.add(""+v);System.out.println(o);}',
  ),
});
graphPractice.push({
  topic: "graph-matrix",
  title: "도로 연결 행렬",
  statement:
    "무방향 그래프에서 연결된 두 정점은 1, 나머지는 0으로 표시하는 인접 행렬을 출력하세요.",
  input: "n m, 이어서 m개의 간선 u v",
  output: "n개 행에 각각 n개의 0 또는 1, 공백 하나로 구분",
  constraints:
    "1 ≤ n ≤ 100, 0 ≤ m ≤ n(n-1)/2, 정점 번호 0..n-1, 중복 간선·자기 루프 없음",
  time: "O(n² + m log n)",
  space: "O(n + m)",
  tests: cases(
    ["3 2\n0 2\n1 2\n", "0 0 1\n0 0 1\n1 1 0\n"],
    ["1 0\n", "0\n"],
    ["2 0\n", "0 0\n0 0\n"],
  ),
  refs: programs(
    pyGraph +
      "for row in g:\n    neighbors=set(row)\n    print(*[int(j in neighbors) for j in range(n)])",
    cppGraph +
      'for(auto &r:g){vector<int>a(n);for(int v:r)a[v]=1;for(int j=0;j<n;j++)cout<<(j?" ":"")<<a[j];cout<<\'\\n\';}',
    javaGraph +
      'for(var r:g){int[] a=new int[n];for(int v:r)a[v]=1;StringJoiner o=new StringJoiner(" ");for(int x:a)o.add(""+x);System.out.println(o);}',
  ),
});
graphPractice.push({
  topic: "dfs",
  title: "작은 정점부터 깊이 탐색",
  statement:
    "무방향 그래프의 시작 정점에서 도달 가능한 정점을 DFS로 방문하세요. 이웃 번호가 작은 순서로 재귀 방문하고 각 정점은 한 번만 출력하세요.",
  input: "n m, m개의 간선 u v, 마지막 시작 정점 s",
  output: "방문 순서를 공백 하나로 구분한 한 줄",
  constraints:
    "1 ≤ n ≤ 100, 0 ≤ m ≤ n(n-1)/2, 정점 번호 0..n-1, 중복 간선·자기 루프 없음",
  time: "O(n + m log n)",
  space: "O(n + m)",
  tests: cases(
    ["5 4\n0 2\n0 1\n1 3\n2 3\n0\n", "0 1 3 2\n"],
    ["1 0\n0\n", "0\n"],
    ["3 1\n0 1\n2\n", "2\n"],
  ),
  refs: programs(
    pyGraph +
      "seen=set();order=[]\ndef visit(u):\n    seen.add(u);order.append(u)\n    for v in g[u]:\n        if v not in seen: visit(v)\nvisit(ni())\nprint(*order)",
    cppGraph +
      'vector<int>seen(n),order;function<void(int)>visit=[&](int u){seen[u]=1;order.push_back(u);for(int v:g[u])if(!seen[v])visit(v);};int s;cin>>s;visit(s);for(int i=0;i<(int)order.size();i++)cout<<(i?" ":"")<<order[i];cout<<\'\\n\';',
    javaGraph +
      'boolean[] seen=new boolean[n];List<Integer> order=new ArrayList<>();visit(sc.nextInt(),g,seen,order);StringJoiner o=new StringJoiner(" ");for(int v:order)o.add(""+v);System.out.println(o);',
    "",
    "static void visit(int u,List<List<Integer>> g,boolean[] seen,List<Integer> order){seen[u]=true;order.add(u);for(int v:g.get(u))if(!seen[v])visit(v,g,seen,order);}",
  ),
});
graphPractice.push({
  topic: "floyd-warshall",
  title: "모든 도시 사이의 최단 거리",
  statement:
    "방향 간선으로 연결된 모든 정점 쌍의 최단 거리를 구하세요. 자기 자신까지 거리는 0이며 도달 불가능하면 INF입니다. 평행 간선은 가장 짧은 것을 사용할 수 있습니다.",
  input: "n m, 이어서 m개 간선 u v w",
  output: "n×n 거리 행렬. 각 행은 공백 하나로 구분",
  constraints: "1 ≤ n ≤ 30, 0 ≤ m ≤ 200, 0 ≤ u,v < n, 0 ≤ w ≤ 1000",
  time: "O(n³ + m)",
  space: "O(n² + m)",
  tests: cases(
    ["3 3\n0 1 2\n1 2 3\n0 2 9\n", "0 2 5\nINF 0 3\nINF INF 0\n"],
    ["1 0\n", "0\n"],
    ["2 2\n0 1 5\n0 1 2\n", "0 2\nINF 0\n"],
  ),
  refs: programs(
    'n,m=ni(),ni();INF=10**15\nd=[[INF]*n for _ in range(n)]\nfor i in range(n): d[i][i]=0\nfor _ in range(m):\n    u,v,w=ni(),ni(),ni();d[u][v]=min(d[u][v],w)\nfor k in range(n):\n    for i in range(n):\n        for j in range(n): d[i][j]=min(d[i][j],d[i][k]+d[k][j])\nfor row in d: print(*["INF" if x==INF else x for x in row])',
    "int n,m;cin>>n>>m;long long INF=1000000000000000LL;vector<vector<long long>>d(n,vector<long long>(n,INF));for(int i=0;i<n;i++)d[i][i]=0;for(int i=0,u,v,w;i<m;i++){cin>>u>>v>>w;d[u][v]=min(d[u][v],(long long)w);}for(int k=0;k<n;k++)for(int i=0;i<n;i++)for(int j=0;j<n;j++)d[i][j]=min(d[i][j],d[i][k]+d[k][j]);for(auto&r:d){for(int j=0;j<n;j++){if(j)cout<<' ';if(r[j]==INF)cout<<\"INF\";else cout<<r[j];}cout<<'\\n';}",
    'int n=sc.nextInt(),m=sc.nextInt();long INF=1000000000000000L;long[][]d=new long[n][n];for(int i=0;i<n;i++){Arrays.fill(d[i],INF);d[i][i]=0;}for(int i=0;i<m;i++){int u=sc.nextInt(),v=sc.nextInt(),w=sc.nextInt();d[u][v]=Math.min(d[u][v],w);}for(int k=0;k<n;k++)for(int i=0;i<n;i++)for(int j=0;j<n;j++)d[i][j]=Math.min(d[i][j],d[i][k]+d[k][j]);for(long[]r:d){StringJoiner o=new StringJoiner(" ");for(long x:r)o.add(x==INF?"INF":""+x);System.out.println(o);}',
  ),
});

for (const bellman of [false, true]) {
  graphPractice.push({
    topic: bellman ? "bellman-ford" : "dijkstra",
    title: bellman ? "음수 간선이 있는 배송 경로" : "배송 출발점의 최단 거리",
    statement:
      "방향 그래프에서 시작 정점 s로부터 모든 정점까지 최단 거리를 구하세요. 도달 불가능하면 INF입니다. " +
      (bellman
        ? "s에서 도달 가능한 음수 사이클이 있으면 거리 대신 NEGATIVE CYCLE만 출력합니다."
        : "간선 가중치는 음수가 아닙니다."),
    input: "n m, m개 간선 u v w, 마지막 시작 정점 s",
    output:
      "정점 0..n-1의 거리 한 줄" + (bellman ? " 또는 NEGATIVE CYCLE" : ""),
    constraints:
      "1 ≤ n ≤ 50, 0 ≤ m ≤ 200, 0 ≤ u,v,s < n, " +
      (bellman ? "-1000" : "0") +
      " ≤ w ≤ 1000. 평행 간선·자기 루프 허용",
    time: bellman ? "O(nm + n)" : "O((n + m) log(n + m))",
    space: "O(n + m)",
    tests: bellman
      ? cases(
          ["4 3\n0 1 4\n1 2 -2\n0 2 5\n0\n", "0 4 2 INF\n"],
          ["3 3\n0 1 1\n1 2 -2\n2 1 -2\n0\n", "NEGATIVE CYCLE\n"],
          ["3 1\n1 1 -1\n0\n", "0 INF INF\n"],
        )
      : cases(
          ["4 4\n0 1 7\n0 2 2\n2 1 1\n1 3 4\n0\n", "0 3 2 7\n"],
          ["2 0\n1\n", "INF 0\n"],
          ["2 2\n0 1 5\n0 1 0\n0\n", "0 0\n"],
        ),
    refs: programs(
      bellman
        ? 'n,m=ni(),ni();edges=[(ni(),ni(),ni()) for _ in range(m)];s=ni();INF=10**15\nd=[INF]*n;d[s]=0\nfor _ in range(n-1):\n    for u,v,w in edges:\n        if d[u]!=INF: d[v]=min(d[v],d[u]+w)\nif any(d[u]!=INF and d[u]+w<d[v] for u,v,w in edges): print("NEGATIVE CYCLE")\nelse: print(*["INF" if x==INF else x for x in d])'
        : 'import heapq\nn,m=ni(),ni();g=[[] for _ in range(n)]\nfor _ in range(m):\n    u,v,w=ni(),ni(),ni();g[u].append((v,w))\ns=ni();INF=10**15;d=[INF]*n;d[s]=0;pq=[(0,s)]\nwhile pq:\n    cost,u=heapq.heappop(pq)\n    if cost!=d[u]: continue\n    for v,w in g[u]:\n        if cost+w<d[v]:\n            d[v]=cost+w;heapq.heappush(pq,(d[v],v))\nprint(*["INF" if x==INF else x for x in d])',
      bellman
        ? "int n,m;cin>>n>>m;vector<vector<int>>e(m,vector<int>(3));for(auto&r:e)cin>>r[0]>>r[1]>>r[2];int s;cin>>s;long long INF=1000000000000000LL;vector<long long>d(n,INF);d[s]=0;for(int k=1;k<n;k++)for(auto&r:e)if(d[r[0]]!=INF)d[r[1]]=min(d[r[1]],d[r[0]]+r[2]);for(auto&r:e)if(d[r[0]]!=INF&&d[r[0]]+r[2]<d[r[1]]){cout<<\"NEGATIVE CYCLE\\n\";return 0;}for(int i=0;i<n;i++){if(i)cout<<' ';if(d[i]==INF)cout<<\"INF\";else cout<<d[i];}cout<<'\\n';"
        : "int n,m;cin>>n>>m;vector<vector<pair<int,int>>>g(n);for(int i=0,u,v,w;i<m;i++){cin>>u>>v>>w;g[u].push_back({v,w});}int s;cin>>s;long long INF=1000000000000000LL;vector<long long>d(n,INF);d[s]=0;priority_queue<pair<long long,int>,vector<pair<long long,int>>,greater<pair<long long,int>>>pq;pq.push({0,s});while(!pq.empty()){auto [cost,u]=pq.top();pq.pop();if(cost!=d[u])continue;for(auto [v,w]:g[u])if(cost+w<d[v]){d[v]=cost+w;pq.push({d[v],v});}}for(int i=0;i<n;i++){if(i)cout<<' ';if(d[i]==INF)cout<<\"INF\";else cout<<d[i];}cout<<'\\n';",
      bellman
        ? 'int n=sc.nextInt(),m=sc.nextInt();int[][]e=new int[m][3];for(int[]r:e)for(int j=0;j<3;j++)r[j]=sc.nextInt();int s=sc.nextInt();long INF=1000000000000000L;long[]d=new long[n];Arrays.fill(d,INF);d[s]=0;for(int k=1;k<n;k++)for(int[]r:e)if(d[r[0]]!=INF)d[r[1]]=Math.min(d[r[1]],d[r[0]]+r[2]);for(int[]r:e)if(d[r[0]]!=INF&&d[r[0]]+r[2]<d[r[1]]){System.out.println("NEGATIVE CYCLE");return;}StringJoiner o=new StringJoiner(" ");for(long x:d)o.add(x==INF?"INF":""+x);System.out.println(o);'
        : 'int n=sc.nextInt(),m=sc.nextInt();List<List<int[]>>g=new ArrayList<>();for(int i=0;i<n;i++)g.add(new ArrayList<>());for(int i=0;i<m;i++){int u=sc.nextInt(),v=sc.nextInt(),w=sc.nextInt();g.get(u).add(new int[]{v,w});}int s=sc.nextInt();long INF=1000000000000000L;long[]d=new long[n];Arrays.fill(d,INF);d[s]=0;PriorityQueue<long[]>pq=new PriorityQueue<>(Comparator.comparingLong(a->a[0]));pq.add(new long[]{0,s});while(!pq.isEmpty()){long[]p=pq.remove();long cost=p[0];int u=(int)p[1];if(cost!=d[u])continue;for(int[]e:g.get(u))if(cost+e[1]<d[e[0]]){d[e[0]]=cost+e[1];pq.add(new long[]{d[e[0]],e[0]});}}StringJoiner o=new StringJoiner(" ");for(long x:d)o.add(x==INF?"INF":""+x);System.out.println(o);',
    ),
  });
}
graphPractice.push({
  topic: "topological-sort",
  title: "가장 작은 번호부터 작업하기",
  statement:
    "선행 관계 u→v는 u를 v보다 먼저 처리해야 한다는 뜻입니다. 가능한 위상 순서 중 사전순으로 가장 작은 정점 순서를 출력하세요. 사이클로 불가능하면 CYCLE을 출력합니다.",
  input: "n m, 이어서 m개 선행 관계 u v",
  output: "정점 순서 한 줄 또는 CYCLE",
  constraints: "1 ≤ n ≤ 100, 0 ≤ m ≤ 500, 0 ≤ u,v < n, 중복 관계 없음",
  time: "O((n + m) log n)",
  space: "O(n + m)",
  tests: cases(
    ["4 3\n0 2\n1 2\n2 3\n", "0 1 2 3\n"],
    ["2 2\n0 1\n1 0\n", "CYCLE\n"],
    ["3 0\n", "0 1 2\n"],
  ),
  refs: programs(
    'import heapq\nn,m=ni(),ni();g=[[] for _ in range(n)];degree=[0]*n\nfor _ in range(m):\n    u,v=ni(),ni();g[u].append(v);degree[v]+=1\nq=[i for i in range(n) if degree[i]==0];heapq.heapify(q);order=[]\nwhile q:\n    u=heapq.heappop(q);order.append(u)\n    for v in g[u]:\n        degree[v]-=1\n        if degree[v]==0: heapq.heappush(q,v)\nif len(order)<n: print("CYCLE")\nelse: print(*order)',
    'int n,m;cin>>n>>m;vector<vector<int>>g(n);vector<int>d(n),o;for(int i=0,u,v;i<m;i++){cin>>u>>v;g[u].push_back(v);d[v]++;}priority_queue<int,vector<int>,greater<int>>q;for(int i=0;i<n;i++)if(!d[i])q.push(i);while(!q.empty()){int u=q.top();q.pop();o.push_back(u);for(int v:g[u])if(--d[v]==0)q.push(v);}if((int)o.size()!=n)cout<<"CYCLE\\n";else{for(int i=0;i<n;i++)cout<<(i?" ":"")<<o[i];cout<<\'\\n\';}',
    'int n=sc.nextInt(),m=sc.nextInt();List<List<Integer>>g=new ArrayList<>();for(int i=0;i<n;i++)g.add(new ArrayList<>());int[]d=new int[n];for(int i=0;i<m;i++){int u=sc.nextInt(),v=sc.nextInt();g.get(u).add(v);d[v]++;}PriorityQueue<Integer>q=new PriorityQueue<>();for(int i=0;i<n;i++)if(d[i]==0)q.add(i);List<Integer>o=new ArrayList<>();while(!q.isEmpty()){int u=q.remove();o.add(u);for(int v:g.get(u))if(--d[v]==0)q.add(v);}if(o.size()!=n)System.out.println("CYCLE");else{StringJoiner out=new StringJoiner(" ");for(int v:o)out.add(""+v);System.out.println(out);}',
  ),
});
