import { programs, cases, type PracticeSpec } from "./practice-spec.js";
export const treePractice: PracticeSpec[] = [];
treePractice.push({
  topic: "lca",
  title: "두 정점의 가장 가까운 공통 조상",
  statement:
    "0을 루트로 하는 트리에서 각 질의의 두 정점에 대해 깊이가 가장 큰 공통 조상을 출력하세요. 정점 자신도 자신의 조상입니다.",
  input: "n q, n-1개의 무방향 간선 u v, q개 질의 a b",
  output: "각 질의의 LCA 정점 번호를 한 줄씩 출력",
  constraints: "1 ≤ n,q ≤ 500, 정점 번호 0..n-1, 입력 간선은 트리",
  time: "O((n + q) log n)",
  space: "O(n log n + q)",
  tests: cases(
    ["5 3\n0 1\n0 2\n1 3\n1 4\n3 4\n2 4\n1 3\n", "1\n0\n1\n"],
    ["1 1\n0 0\n", "0\n"],
    ["4 2\n0 1\n1 2\n2 3\n3 1\n3 3\n", "1\n3\n"],
  ),
  refs: programs(
    "n,q=ni(),ni();g=[[] for _ in range(n)]\nfor _ in range(n-1):\n    u,v=ni(),ni();g[u].append(v);g[v].append(u)\nlevels=n.bit_length();up=[[0]*n for _ in range(levels)];depth=[0]*n;stack=[(0,0)]\nwhile stack:\n    u,p=stack.pop();up[0][u]=p\n    for v in g[u]:\n        if v!=p: depth[v]=depth[u]+1;stack.append((v,u))\nfor k in range(1,levels):\n    for u in range(n): up[k][u]=up[k-1][up[k-1][u]]\nfor _ in range(q):\n    a,b=ni(),ni()\n    if depth[a]<depth[b]: a,b=b,a\n    diff=depth[a]-depth[b]\n    for k in range(levels):\n        if diff>>k&1: a=up[k][a]\n    if a!=b:\n        for k in range(levels-1,-1,-1):\n            if up[k][a]!=up[k][b]: a,b=up[k][a],up[k][b]\n        a=up[0][a]\n    print(a)",
    "int n,q;cin>>n>>q;vector<vector<int>>g(n);for(int i=1,u,v;i<n;i++){cin>>u>>v;g[u].push_back(v);g[v].push_back(u);}int L=1;while((1<<L)<=n)L++;vector<vector<int>>up(L,vector<int>(n));vector<int>d(n),order{0};for(int i=0;i<(int)order.size();i++){int u=order[i];for(int v:g[u])if(v!=up[0][u]){up[0][v]=u;d[v]=d[u]+1;order.push_back(v);}}for(int k=1;k<L;k++)for(int u=0;u<n;u++)up[k][u]=up[k-1][up[k-1][u]];while(q--){int a,b;cin>>a>>b;if(d[a]<d[b])swap(a,b);int diff=d[a]-d[b];for(int k=0;k<L;k++)if(diff>>k&1)a=up[k][a];if(a!=b){for(int k=L-1;k>=0;k--)if(up[k][a]!=up[k][b]){a=up[k][a];b=up[k][b];}a=up[0][a];}cout<<a<<'\\n';}",
    "int n=sc.nextInt(),q=sc.nextInt();List<List<Integer>>g=new ArrayList<>();for(int i=0;i<n;i++)g.add(new ArrayList<>());for(int i=1;i<n;i++){int u=sc.nextInt(),v=sc.nextInt();g.get(u).add(v);g.get(v).add(u);}int L=1;while((1<<L)<=n)L++;int[][]up=new int[L][n];int[]d=new int[n];List<Integer>order=new ArrayList<>();order.add(0);for(int i=0;i<order.size();i++){int u=order.get(i);for(int v:g.get(u))if(v!=up[0][u]){up[0][v]=u;d[v]=d[u]+1;order.add(v);}}for(int k=1;k<L;k++)for(int u=0;u<n;u++)up[k][u]=up[k-1][up[k-1][u]];while(q-->0){int a=sc.nextInt(),b=sc.nextInt();if(d[a]<d[b]){int t=a;a=b;b=t;}int diff=d[a]-d[b];for(int k=0;k<L;k++)if((diff>>k&1)!=0)a=up[k][a];if(a!=b){for(int k=L-1;k>=0;k--)if(up[k][a]!=up[k][b]){a=up[k][a];b=up[k][b];}a=up[0][a];}System.out.println(a);}",
  ),
});
const pyAVL =
  "class Node:\n    def __init__(self,x): self.x=x;self.left=self.right=None;self.h=1\ndef height(t): return t.h if t else 0\ndef update(t): t.h=1+max(height(t.left),height(t.right))\ndef right(t):\n    r=t.left;t.left=r.right;r.right=t;update(t);update(r);return r\ndef left(t):\n    r=t.right;t.right=r.left;r.left=t;update(t);update(r);return r\ndef insert(t,x):\n    if not t: return Node(x)\n    if x<t.x: t.left=insert(t.left,x)\n    elif x>t.x: t.right=insert(t.right,x)\n    else: return t\n    update(t);balance=height(t.left)-height(t.right)\n    if balance>1:\n        if x>t.left.x: t.left=left(t.left)\n        return right(t)\n    if balance< -1:\n        if x<t.right.x: t.right=right(t.right)\n        return left(t)\n    return t\nn=ni();root=None\nfor _ in range(n): root=insert(root,ni())\nprint(root.x,root.h)";
const cppAVL =
  "struct Node{int x,h=1;Node*l=nullptr,*r=nullptr;Node(int v):x(v){}};int h(Node*t){return t?t->h:0;}void upd(Node*t){t->h=1+max(h(t->l),h(t->r));}Node*right(Node*t){Node*r=t->l;t->l=r->r;r->r=t;upd(t);upd(r);return r;}Node*left(Node*t){Node*r=t->r;t->r=r->l;r->l=t;upd(t);upd(r);return r;}Node*ins(Node*t,int x){if(!t)return new Node(x);if(x<t->x)t->l=ins(t->l,x);else if(x>t->x)t->r=ins(t->r,x);else return t;upd(t);int b=h(t->l)-h(t->r);if(b>1){if(x>t->l->x)t->l=left(t->l);return right(t);}if(b< -1){if(x<t->r->x)t->r=right(t->r);return left(t);}return t;}";
const javaAVL =
  "static class Node{int x,h=1;Node l,r;Node(int v){x=v;}}static int h(Node t){return t==null?0:t.h;}static void upd(Node t){t.h=1+Math.max(h(t.l),h(t.r));}static Node right(Node t){Node r=t.l;t.l=r.r;r.r=t;upd(t);upd(r);return r;}static Node left(Node t){Node r=t.r;t.r=r.l;r.l=t;upd(t);upd(r);return r;}static Node ins(Node t,int x){if(t==null)return new Node(x);if(x<t.x)t.l=ins(t.l,x);else if(x>t.x)t.r=ins(t.r,x);else return t;upd(t);int b=h(t.l)-h(t.r);if(b>1){if(x>t.l.x)t.l=left(t.l);return right(t);}if(b< -1){if(x<t.r.x)t.r=right(t.r);return left(t);}return t;}";
treePractice.push({
  topic: "balanced-tree",
  title: "AVL 삽입 후 루트와 높이",
  statement:
    "빈 AVL 트리에 주어진 순서대로 정수를 삽입하세요. 중복 값은 무시합니다. 매 삽입 후 LL·RR은 단일 회전, LR·RL은 이중 회전으로 균형을 맞춥니다. 최종 루트 값과 높이를 출력하세요. 빈 트리 높이는 0, 잎은 1입니다.",
  input: "n, 이어서 삽입할 n개 정수",
  output: "루트 값과 트리 높이를 공백 하나로 구분한 한 줄",
  constraints: "1 ≤ n ≤ 500, |값| ≤ 1000000",
  time: "O(n log n)",
  space: "O(n)",
  tests: cases(
    ["3\n30 20 10\n", "20 2\n"],
    ["3\n10 30 20\n", "20 2\n"],
    ["1\n5\n", "5 1\n"],
    ["5\n30 10 20 40 50\n", "20 3\n"],
    ["3\n7 7 7\n", "7 1\n"],
  ),
  refs: programs(
    pyAVL,
    "int n,x;cin>>n;Node*root=nullptr;while(n--){cin>>x;root=ins(root,x);}cout<<root->x<<' '<<root->h<<'\\n';",
    'int n=sc.nextInt();Node root=null;while(n-->0)root=ins(root,sc.nextInt());System.out.println(root.x+" "+root.h);',
    cppAVL,
    javaAVL,
  ),
});
