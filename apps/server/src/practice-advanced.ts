import { programs, cases, type PracticeSpec } from "./practice-spec.js";
export const advancedPractice: PracticeSpec[] = [];
advancedPractice.push({
  topic: "scc",
  title: "서로 왕복 가능한 도시 그룹",
  statement:
    "방향 그래프에서 서로 도달 가능한 정점끼리 묶으세요. 각 정점이 속한 강한 연결 요소에서 가장 작은 정점 번호를 그 정점의 대표 번호로 출력합니다.",
  input: "n m, 이어서 m개 방향 간선 u v",
  output: "정점 0..n-1의 대표 번호를 공백으로 구분한 한 줄",
  constraints: "1 ≤ n ≤ 100, 0 ≤ m ≤ 500, 0 ≤ u,v < n",
  time: "O(n + m)",
  space: "O(n + m)",
  tests: cases(
    ["5 6\n0 1\n1 0\n1 2\n2 3\n3 2\n3 4\n", "0 0 2 2 4\n"],
    ["3 0\n", "0 1 2\n"],
    ["3 3\n0 1\n1 2\n2 0\n", "0 0 0\n"],
  ),
  refs: programs(
    "n,m=ni(),ni();g=[[] for _ in range(n)];rev=[[] for _ in range(n)]\nfor _ in range(m):\n    u,v=ni(),ni();g[u].append(v);rev[v].append(u)\nseen=[False]*n;order=[]\ndef dfs(u):\n    seen[u]=True\n    for v in g[u]:\n        if not seen[v]: dfs(v)\n    order.append(u)\nfor u in range(n):\n    if not seen[u]: dfs(u)\nseen=[False]*n;answer=[0]*n\ndef collect(u,group):\n    seen[u]=True;group.append(u)\n    for v in rev[u]:\n        if not seen[v]: collect(v,group)\nfor u in reversed(order):\n    if not seen[u]:\n        group=[];collect(u,group);label=min(group)\n        for v in group: answer[v]=label\nprint(*answer)",
    'int n,m;cin>>n>>m;vector<vector<int>>g(n),r(n);for(int i=0,u,v;i<m;i++){cin>>u>>v;g[u].push_back(v);r[v].push_back(u);}vector<int>seen(n),order,ans(n);function<void(int)>dfs=[&](int u){seen[u]=1;for(int v:g[u])if(!seen[v])dfs(v);order.push_back(u);};for(int u=0;u<n;u++)if(!seen[u])dfs(u);fill(seen.begin(),seen.end(),0);vector<int>group;function<void(int)>collect=[&](int u){seen[u]=1;group.push_back(u);for(int v:r[u])if(!seen[v])collect(v);};reverse(order.begin(),order.end());for(int u:order)if(!seen[u]){group.clear();collect(u);int label=*min_element(group.begin(),group.end());for(int v:group)ans[v]=label;}for(int i=0;i<n;i++)cout<<(i?" ":"")<<ans[i];cout<<\'\\n\';',
    'int n=sc.nextInt(),m=sc.nextInt();List<List<Integer>>g=new ArrayList<>(),r=new ArrayList<>();for(int i=0;i<n;i++){g.add(new ArrayList<>());r.add(new ArrayList<>());}for(int i=0;i<m;i++){int u=sc.nextInt(),v=sc.nextInt();g.get(u).add(v);r.get(v).add(u);}boolean[]seen=new boolean[n];List<Integer>order=new ArrayList<>();for(int u=0;u<n;u++)if(!seen[u])dfs(u,g,seen,order);Arrays.fill(seen,false);Collections.reverse(order);int[]ans=new int[n];for(int u:order)if(!seen[u]){List<Integer>group=new ArrayList<>();dfs(u,r,seen,group);int label=Collections.min(group);for(int v:group)ans[v]=label;}StringJoiner out=new StringJoiner(" ");for(int v:ans)out.add(""+v);System.out.println(out);',
    "",
    "static void dfs(int u,List<List<Integer>>g,boolean[]seen,List<Integer>order){seen[u]=true;for(int v:g.get(u))if(!seen[v])dfs(v,g,seen,order);order.add(u);}",
  ),
});
advancedPractice.push({
  topic: "flow",
  title: "수송망의 최대 유량",
  statement:
    "정점 0에서 정점 n-1로 보낼 수 있는 최대 유량을 구하세요. 각 방향 간선의 용량을 넘을 수 없고 중간 정점에서는 유입과 유출이 같습니다. 평행 간선 용량은 합산합니다.",
  input: "n m, 이어서 m개 방향 간선 u v c",
  output: "최대 유량 한 줄",
  constraints: "2 ≤ n ≤ 30, 0 ≤ m ≤ 200, 0 ≤ u,v < n, u ≠ v, 0 ≤ c ≤ 1000",
  time: "O(n² + nm²)",
  space: "O(n² + m)",
  tests: cases(
    ["4 5\n0 1 3\n0 2 2\n1 2 1\n1 3 2\n2 3 3\n", "5\n"],
    ["2 2\n0 1 1\n0 1 2\n", "3\n"],
    ["3 1\n0 1 5\n", "0\n"],
  ),
  refs: programs(
    "from collections import deque\nn,m=ni(),ni();cap=[[0]*n for _ in range(n)];g=[set() for _ in range(n)]\nfor _ in range(m):\n    u,v,c=ni(),ni(),ni();cap[u][v]+=c;g[u].add(v);g[v].add(u)\ntotal=0\nwhile True:\n    parent=[-1]*n;parent[0]=0;q=deque([0])\n    while q and parent[n-1]==-1:\n        u=q.popleft()\n        for v in g[u]:\n            if parent[v]==-1 and cap[u][v]>0: parent[v]=u;q.append(v)\n    if parent[n-1]==-1: break\n    amount=10**15;v=n-1\n    while v: amount=min(amount,cap[parent[v]][v]);v=parent[v]\n    v=n-1\n    while v:\n        u=parent[v];cap[u][v]-=amount;cap[v][u]+=amount;v=u\n    total+=amount\nprint(total)",
    "int n,m;cin>>n>>m;vector<vector<long long>>c(n,vector<long long>(n));vector<set<int>>g(n);for(int i=0,u,v,w;i<m;i++){cin>>u>>v>>w;c[u][v]+=w;g[u].insert(v);g[v].insert(u);}long long total=0;while(true){vector<int>p(n,-1);p[0]=0;queue<int>q;q.push(0);while(!q.empty()&&p[n-1]==-1){int u=q.front();q.pop();for(int v:g[u])if(p[v]==-1&&c[u][v]>0){p[v]=u;q.push(v);}}if(p[n-1]==-1)break;long long amount=1000000000000000LL;for(int v=n-1;v;v=p[v])amount=min(amount,c[p[v]][v]);for(int v=n-1;v;v=p[v]){c[p[v]][v]-=amount;c[v][p[v]]+=amount;}total+=amount;}cout<<total<<'\\n';",
    "int n=sc.nextInt(),m=sc.nextInt();long[][]c=new long[n][n];List<Set<Integer>>g=new ArrayList<>();for(int i=0;i<n;i++)g.add(new TreeSet<>());for(int i=0;i<m;i++){int u=sc.nextInt(),v=sc.nextInt(),w=sc.nextInt();c[u][v]+=w;g.get(u).add(v);g.get(v).add(u);}long total=0;while(true){int[]p=new int[n];Arrays.fill(p,-1);p[0]=0;Deque<Integer>q=new ArrayDeque<>();q.add(0);while(!q.isEmpty()&&p[n-1]==-1){int u=q.remove();for(int v:g.get(u))if(p[v]==-1&&c[u][v]>0){p[v]=u;q.add(v);}}if(p[n-1]==-1)break;long amount=1000000000000000L;for(int v=n-1;v!=0;v=p[v])amount=Math.min(amount,c[p[v]][v]);for(int v=n-1;v!=0;v=p[v]){c[p[v]][v]-=amount;c[v][p[v]]+=amount;}total+=amount;}System.out.println(total);",
  ),
});
advancedPractice.push({
  topic: "kmp",
  title: "겹치는 패턴도 모두 찾기",
  statement:
    "문자열에서 패턴이 등장하는 모든 시작 인덱스를 찾으세요. 인덱스는 0부터이며 서로 겹치는 출현도 포함합니다.",
  input: "첫 토큰은 본문, 둘째 토큰은 패턴",
  output: "첫 줄은 개수, 둘째 줄은 오름차순 인덱스. 없으면 둘째 줄은 빈 줄",
  constraints: "소문자 a..z, 본문·패턴 길이 각각 1..1000",
  time: "O(n + m)",
  space: "O(n + m)",
  tests: cases(
    ["ababa aba\n", "2\n0 2\n"],
    ["aaaa aa\n", "3\n0 1 2\n"],
    ["abc z\n", "0\n\n"],
    ["a aa\n", "0\n\n"],
  ),
  refs: programs(
    "text,pattern=ns(),ns();m=len(pattern);pi=[0]*m;j=0\nfor i in range(1,m):\n    while j and pattern[i]!=pattern[j]: j=pi[j-1]\n    if pattern[i]==pattern[j]: j+=1\n    pi[i]=j\nj=0;answer=[]\nfor i,c in enumerate(text):\n    while j and c!=pattern[j]: j=pi[j-1]\n    if c==pattern[j]: j+=1\n    if j==m: answer.append(i-m+1);j=pi[j-1]\nprint(len(answer));print(*answer)",
    "string s,p;cin>>s>>p;int m=p.size(),j=0;vector<int>pi(m),ans;for(int i=1;i<m;i++){while(j&&p[i]!=p[j])j=pi[j-1];if(p[i]==p[j])j++;pi[i]=j;}j=0;for(int i=0;i<(int)s.size();i++){while(j&&s[i]!=p[j])j=pi[j-1];if(s[i]==p[j])j++;if(j==m){ans.push_back(i-m+1);j=pi[j-1];}}cout<<ans.size()<<'\\n';for(int i=0;i<(int)ans.size();i++)cout<<(i?\" \":\"\")<<ans[i];cout<<'\\n';",
    'String s=sc.next(),p=sc.next();int m=p.length(),j=0;int[]pi=new int[m];List<Integer>ans=new ArrayList<>();for(int i=1;i<m;i++){while(j>0&&p.charAt(i)!=p.charAt(j))j=pi[j-1];if(p.charAt(i)==p.charAt(j))j++;pi[i]=j;}j=0;for(int i=0;i<s.length();i++){while(j>0&&s.charAt(i)!=p.charAt(j))j=pi[j-1];if(s.charAt(i)==p.charAt(j))j++;if(j==m){ans.add(i-m+1);j=pi[j-1];}}System.out.println(ans.size());StringJoiner out=new StringJoiner(" ");for(int v:ans)out.add(""+v);System.out.println(out);',
  ),
});
