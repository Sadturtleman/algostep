import { programs, cases, type PracticeSpec } from "./practice-spec.js";
export const structurePractice: PracticeSpec[] = [];
const pyUF =
  "p=list(range(n));size=[1]*n\ndef find(x):\n    while x!=p[x]:\n        p[x]=p[p[x]];x=p[x]\n    return x\ndef unite(a,b):\n    a,b=find(a),find(b)\n    if a==b: return False\n    if size[a]<size[b]: a,b=b,a\n    p[b]=a;size[a]+=size[b]\n    return True\n";
const cppUF =
  "struct DSU{vector<int>p,s;DSU(int n):p(n),s(n,1){iota(p.begin(),p.end(),0);}int find(int x){while(x!=p[x]){p[x]=p[p[x]];x=p[x];}return x;}bool unite(int a,int b){a=find(a);b=find(b);if(a==b)return false;if(s[a]<s[b])swap(a,b);p[b]=a;s[a]+=s[b];return true;}};";
const javaUF =
  "static class DSU{int[]p,s;DSU(int n){p=new int[n];s=new int[n];for(int i=0;i<n;i++){p[i]=i;s[i]=1;}}int find(int x){while(x!=p[x]){p[x]=p[p[x]];x=p[x];}return x;}boolean unite(int a,int b){a=find(a);b=find(b);if(a==b)return false;if(s[a]<s[b]){int t=a;a=b;b=t;}p[b]=a;s[a]+=s[b];return true;}}";
structurePractice.push({
  topic: "union-find",
  title: "친구 그룹 합치기",
  statement:
    "처음에는 각 번호가 별도 그룹입니다. 0 a b는 두 그룹을 합치고, 1 a b는 같은 그룹인지 YES 또는 NO로 답합니다.",
  input: "n q, 이어서 q개의 연산 t a b",
  output: "각 1번 연산의 답을 한 줄씩 출력",
  constraints: "1 ≤ n,q ≤ 500, 0 ≤ a,b < n, t는 0 또는 1, 조회가 최소 1개",
  time: "O(n + q α(n))",
  space: "O(n + q)",
  tests: cases(
    ["4 5\n1 0 1\n0 0 1\n0 2 1\n1 0 2\n1 0 3\n", "NO\nYES\nNO\n"],
    ["1 1\n1 0 0\n", "YES\n"],
    ["2 3\n0 0 0\n0 0 1\n1 1 0\n", "YES\n"],
  ),
  refs: programs(
    "n,q=ni(),ni()\n" +
      pyUF +
      'for _ in range(q):\n    t,a,b=ni(),ni(),ni()\n    if t==0: unite(a,b)\n    else: print("YES" if find(a)==find(b) else "NO")',
    'int n,q;cin>>n>>q;DSU d(n);while(q--){int t,a,b;cin>>t>>a>>b;if(t==0)d.unite(a,b);else cout<<(d.find(a)==d.find(b)?"YES":"NO")<<\'\\n\';}',
    'int n=sc.nextInt(),q=sc.nextInt();DSU d=new DSU(n);while(q-->0){int t=sc.nextInt(),a=sc.nextInt(),b=sc.nextInt();if(t==0)d.unite(a,b);else System.out.println(d.find(a)==d.find(b)?"YES":"NO");}',
    cppUF,
    javaUF,
  ),
});
structurePractice.push({
  topic: "mst",
  title: "모든 도시를 잇는 최소 비용",
  statement:
    "무방향 간선으로 모든 정점을 연결하는 최소 신장 트리의 가중치 합을 출력하세요. 연결할 수 없으면 DISCONNECTED입니다.",
  input: "n m, 이어서 m개 간선 u v w",
  output: "최소 비용 또는 DISCONNECTED 한 줄",
  constraints:
    "1 ≤ n ≤ 100, 0 ≤ m ≤ 500, 0 ≤ u,v < n, |w| ≤ 1000, 평행 간선·자기 루프 허용",
  time: "O(n + m log(m + 1))",
  space: "O(n + m)",
  tests: cases(
    ["4 5\n0 1 3\n0 2 1\n1 2 2\n1 3 4\n2 3 6\n", "7\n"],
    ["3 1\n0 1 2\n", "DISCONNECTED\n"],
    ["1 0\n", "0\n"],
    ["2 2\n0 1 -3\n0 1 2\n", "-3\n"],
  ),
  refs: programs(
    "n,m=ni(),ni()\n" +
      pyUF +
      'edges=[]\nfor _ in range(m):\n    u,v,w=ni(),ni(),ni();edges.append((w,u,v))\nedges.sort();total=count=0\nfor w,u,v in edges:\n    if unite(u,v): total+=w;count+=1\nprint(total if count==n-1 else "DISCONNECTED")',
    "int n,m;cin>>n>>m;DSU d(n);vector<vector<int>>e;for(int i=0,u,v,w;i<m;i++){cin>>u>>v>>w;e.push_back({w,u,v});}sort(e.begin(),e.end());long long total=0;int count=0;for(auto&r:e)if(d.unite(r[1],r[2])){total+=r[0];count++;}if(count==n-1)cout<<total;else cout<<\"DISCONNECTED\";cout<<'\\n';",
    'int n=sc.nextInt(),m=sc.nextInt();DSU d=new DSU(n);int[][]e=new int[m][3];for(int[]r:e){r[1]=sc.nextInt();r[2]=sc.nextInt();r[0]=sc.nextInt();}Arrays.sort(e,Comparator.comparingInt(a->a[0]));long total=0;int count=0;for(int[]r:e)if(d.unite(r[1],r[2])){total+=r[0];count++;}System.out.println(count==n-1?""+total:"DISCONNECTED");',
    cppUF,
    javaUF,
  ),
});
structurePractice.push({
  topic: "trie",
  title: "접두사로 단어 세기",
  statement:
    "등록한 단어 중 질의 문자열로 시작하는 단어 수를 구하세요. 같은 단어를 여러 번 등록하면 각각 셉니다.",
  input: "n q, n개 단어, q개 접두사(공백 또는 줄바꿈으로 구분)",
  output: "각 접두사에 해당하는 단어 수를 한 줄씩 출력",
  constraints: "1 ≤ n,q ≤ 100, 소문자 a..z, 단어·접두사 길이 1..20",
  time: "O(L)",
  space: "O(L)",
  tests: cases(
    ["4 3\napp apple app bat\napp a z\n", "3\n3\n0\n"],
    ["1 2\na\na aa\n", "1\n0\n"],
    ["3 2\nab abc abd\nab abc\n", "3\n1\n"],
  ),
  refs: programs(
    "n,q=ni(),ni();children=[{}];count=[0]\nfor _ in range(n):\n    u=0\n    for c in ns():\n        if c not in children[u]:\n            children[u][c]=len(children);children.append({});count.append(0)\n        u=children[u][c];count[u]+=1\nfor _ in range(q):\n    u=0\n    for c in ns():\n        u=children[u].get(c,-1) if u!=-1 else -1\n    print(count[u] if u!=-1 else 0)",
    "int n,q;cin>>n>>q;vector<map<char,int>>child(1);vector<int>cnt(1);while(n--){string s;cin>>s;int u=0;for(char c:s){if(!child[u].count(c)){int v=child.size();child[u][c]=v;child.emplace_back();cnt.push_back(0);}u=child[u][c];cnt[u]++;}}while(q--){string s;cin>>s;int u=0;for(char c:s){if(u!=-1){auto it=child[u].find(c);u=it==child[u].end()?-1:it->second;}}cout<<(u==-1?0:cnt[u])<<'\\n';}",
    "int n=sc.nextInt(),q=sc.nextInt();Node root=new Node();while(n-->0){Node u=root;String s=sc.next();for(char c:s.toCharArray()){u=u.child.computeIfAbsent(c,k->new Node());u.count++;}}while(q-->0){Node u=root;for(char c:sc.next().toCharArray())if(u!=null)u=u.child.get(c);System.out.println(u==null?0:u.count);}",
    "",
    "static class Node{Map<Character,Node>child=new HashMap<>();int count;}",
  ),
});
for (const fenwick of [false, true]) {
  structurePractice.push({
    topic: fenwick ? "fenwick" : "segment-tree",
    title: fenwick ? "펜윅 트리로 누적 구간 관리" : "구간 트리로 점수 관리",
    statement:
      "배열 값을 바꾸면서 구간 합을 구하세요. 0 i x는 a[i]를 x로 대입하고, 1 l r는 양 끝을 포함하는 구간 합을 출력합니다.",
    input: "n q, n개 초기 값, q개 연산(0 i x 또는 1 l r)",
    output: "각 합 조회 결과를 한 줄씩 출력",
    constraints:
      "1 ≤ n,q ≤ 500, |a[i]|,|x| ≤ 1000000, 0 ≤ i,l ≤ r < n, 조회 최소 1개",
    time: "O((n + q) log n)",
    space: "O(n + q)",
    tests: cases(
      ["4 4\n1 2 3 4\n1 0 3\n0 1 -5\n1 1 2\n1 3 3\n", "10\n-2\n4\n"],
      ["1 3\n-3\n1 0 0\n0 0 7\n1 0 0\n", "-3\n7\n"],
      ["3 2\n0 0 0\n0 2 9\n1 0 1\n", "0\n"],
    ),
    refs: programs(
      fenwick
        ? "n,q=ni(),ni();a=[ni() for _ in range(n)];bit=[0]*(n+1)\ndef add(i,x):\n    i+=1\n    while i<=n: bit[i]+=x;i+=i&-i\ndef prefix(i):\n    s=0\n    while i>0: s+=bit[i];i-=i&-i\n    return s\nfor i,x in enumerate(a): add(i,x)\nfor _ in range(q):\n    t,l,r=ni(),ni(),ni()\n    if t==0: add(l,r-a[l]);a[l]=r\n    else: print(prefix(r+1)-prefix(l))"
        : "n,q=ni(),ni();a=[ni() for _ in range(n)];size=1\nwhile size<n: size*=2\ntree=[0]*(2*size)\nfor i,x in enumerate(a): tree[size+i]=x\nfor i in range(size-1,0,-1): tree[i]=tree[2*i]+tree[2*i+1]\nfor _ in range(q):\n    t,l,r=ni(),ni(),ni()\n    if t==0:\n        p=size+l;tree[p]=r;p//=2\n        while p: tree[p]=tree[2*p]+tree[2*p+1];p//=2\n    else:\n        l+=size;r+=size+1;total=0\n        while l<r:\n            if l&1: total+=tree[l];l+=1\n            if r&1: r-=1;total+=tree[r]\n            l//=2;r//=2\n        print(total)",
      fenwick
        ? "int n,q;cin>>n>>q;vector<long long>a(n),bit(n+1);auto add=[&](int i,long long x){for(i++;i<=n;i+=i&-i)bit[i]+=x;};auto prefix=[&](int i){long long s=0;for(;i;i-=i&-i)s+=bit[i];return s;};for(int i=0;i<n;i++){cin>>a[i];add(i,a[i]);}while(q--){int t,l;long long r;cin>>t>>l>>r;if(t==0){add(l,r-a[l]);a[l]=r;}else cout<<prefix(r+1)-prefix(l)<<'\\n';}"
        : "int n,q;cin>>n>>q;int size=1;while(size<n)size*=2;vector<long long>tree(2*size);for(int i=0;i<n;i++)cin>>tree[size+i];for(int i=size-1;i;i--)tree[i]=tree[2*i]+tree[2*i+1];while(q--){int t,l;long long x;cin>>t>>l>>x;if(t==0){int p=size+l;tree[p]=x;for(p/=2;p;p/=2)tree[p]=tree[2*p]+tree[2*p+1];}else{int r=(int)x+size+1;l+=size;long long sum=0;while(l<r){if(l&1)sum+=tree[l++];if(r&1)sum+=tree[--r];l/=2;r/=2;}cout<<sum<<'\\n';}}",
      fenwick
        ? "int n=sc.nextInt(),q=sc.nextInt();long[]a=new long[n],bit=new long[n+1];for(int i=0;i<n;i++){a[i]=sc.nextLong();add(bit,i,a[i]);}while(q-->0){int t=sc.nextInt(),l=sc.nextInt();long r=sc.nextLong();if(t==0){add(bit,l,r-a[l]);a[l]=r;}else System.out.println(prefix(bit,(int)r+1)-prefix(bit,l));}"
        : "int n=sc.nextInt(),q=sc.nextInt(),size=1;while(size<n)size*=2;long[]tree=new long[size*2];for(int i=0;i<n;i++)tree[size+i]=sc.nextLong();for(int i=size-1;i>0;i--)tree[i]=tree[2*i]+tree[2*i+1];while(q-->0){int t=sc.nextInt(),l=sc.nextInt();long x=sc.nextLong();if(t==0){int p=size+l;tree[p]=x;for(p/=2;p>0;p/=2)tree[p]=tree[2*p]+tree[2*p+1];}else{int r=(int)x+size+1;l+=size;long sum=0;while(l<r){if((l&1)!=0)sum+=tree[l++];if((r&1)!=0)sum+=tree[--r];l/=2;r/=2;}System.out.println(sum);}}",
      "",
      fenwick
        ? "static void add(long[]bit,int i,long x){for(i++;i<bit.length;i+=i&-i)bit[i]+=x;}static long prefix(long[]bit,int i){long s=0;for(;i>0;i-=i&-i)s+=bit[i];return s;}"
        : "",
    ),
  });
}
