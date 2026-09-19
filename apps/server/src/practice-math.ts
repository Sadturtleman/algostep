import { programs, cases, type PracticeSpec } from "./practice-spec.js";
export const mathPractice: PracticeSpec[] = [];
mathPractice.push({
  topic: "advanced-dp",
  title: "수열을 나누는 최소 제곱 비용",
  statement:
    "음수가 아닌 수열을 정확히 k개의 비어 있지 않은 연속 구간으로 나누세요. 각 구간 원소 합의 제곱을 비용으로 할 때 전체 비용의 최솟값을 구하세요. 권장 풀이는 최적 분할점의 단조성을 이용하는 분할 정복 DP입니다.",
  input: "n k, 이어서 n개 정수",
  output: "최소 비용 한 줄",
  constraints: "1 ≤ k ≤ n ≤ 100, 0 ≤ a[i] ≤ 1000",
  time: "O(kn log n)",
  space: "O(n)",
  tests: cases(
    ["4 2\n1 2 3 4\n", "52\n"],
    ["3 3\n0 0 2\n", "4\n"],
    ["1 1\n5\n", "25\n"],
    ["5 2\n0 0 0 0 0\n", "0\n"],
  ),
  refs: programs(
    "n,k=ni(),ni();prefix=[0]\nfor _ in range(n): prefix.append(prefix[-1]+ni())\nINF=10**18;prev=[INF]*(n+1);prev[0]=0\nfor group in range(1,k+1):\n    cur=[INF]*(n+1)\n    def solve(left,right,optleft,optright):\n        if left>right: return\n        mid=(left+right)//2;best=optleft\n        for j in range(optleft,min(mid-1,optright)+1):\n            cost=prev[j]+(prefix[mid]-prefix[j])**2\n            if cost<cur[mid]: cur[mid]=cost;best=j\n        solve(left,mid-1,optleft,best);solve(mid+1,right,best,optright)\n    solve(group,n,group-1,n-1);prev=cur\nprint(prev[n])",
    "int n,k;cin>>n>>k;vector<long long>p(n+1);for(int i=1,x;i<=n;i++){cin>>x;p[i]=p[i-1]+x;}long long INF=1000000000000000000LL;vector<long long>prev(n+1,INF);prev[0]=0;for(int group=1;group<=k;group++){vector<long long>cur(n+1,INF);function<void(int,int,int,int)>solve=[&](int l,int r,int ol,int orr){if(l>r)return;int mid=(l+r)/2,best=ol;for(int j=ol;j<=min(mid-1,orr);j++){long long d=p[mid]-p[j],cost=prev[j]+d*d;if(cost<cur[mid]){cur[mid]=cost;best=j;}}solve(l,mid-1,ol,best);solve(mid+1,r,best,orr);};solve(group,n,group-1,n-1);prev=cur;}cout<<prev[n]<<'\\n';",
    "int n=sc.nextInt(),k=sc.nextInt();long[]p=new long[n+1];for(int i=1;i<=n;i++)p[i]=p[i-1]+sc.nextInt();long INF=1000000000000000000L;long[]prev=new long[n+1];Arrays.fill(prev,INF);prev[0]=0;for(int group=1;group<=k;group++){long[]cur=new long[n+1];Arrays.fill(cur,INF);solve(group,n,group-1,n-1,p,prev,cur);prev=cur;}System.out.println(prev[n]);",
    "",
    "static void solve(int l,int r,int ol,int orr,long[]p,long[]prev,long[]cur){if(l>r)return;int mid=(l+r)/2,best=ol;for(int j=ol;j<=Math.min(mid-1,orr);j++){long d=p[mid]-p[j],cost=prev[j]+d*d;if(cost<cur[mid]){cur[mid]=cost;best=j;}}solve(l,mid-1,ol,best,p,prev,cur);solve(mid+1,r,best,orr,p,prev,cur);}",
  ),
});
mathPractice.push({
  topic: "geometry",
  title: "점들을 감싸는 볼록 껍질",
  statement:
    "주어진 점들의 볼록 껍질 꼭짓점을 구하세요. 중복 점과 변 중간의 일직선상 점은 제외합니다. x, 그다음 y가 가장 작은 점부터 반시계 방향으로 출력하세요. 모두 일직선이면 양 끝점만, 서로 다른 점이 하나면 그 점만 출력합니다.",
  input: "n, 이어서 n개 점 x y",
  output: "첫 줄 꼭짓점 수, 다음 줄부터 꼭짓점의 x y",
  constraints: "1 ≤ n ≤ 500, 정수 좌표, |x|,|y| ≤ 1000",
  time: "O(n log n)",
  space: "O(n)",
  tests: cases(
    ["5\n0 0\n2 0\n2 2\n0 2\n1 1\n", "4\n0 0\n2 0\n2 2\n0 2\n"],
    ["4\n0 0\n1 1\n2 2\n1 1\n", "2\n0 0\n2 2\n"],
    ["1\n3 -2\n", "1\n3 -2\n"],
  ),
  refs: programs(
    "n=ni();points=sorted(set((ni(),ni()) for _ in range(n)))\ndef cross(a,b,c): return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])\ndef half(points):\n    h=[]\n    for p in points:\n        while len(h)>=2 and cross(h[-2],h[-1],p)<=0: h.pop()\n        h.append(p)\n    return h\nh=points if len(points)==1 else half(points)[:-1]+half(reversed(points))[:-1]\nprint(len(h))\nfor p in h: print(*p)",
    "int n;cin>>n;vector<pair<long long,long long>>p(n);for(auto&v:p)cin>>v.first>>v.second;sort(p.begin(),p.end());p.erase(unique(p.begin(),p.end()),p.end());auto cross=[](auto a,auto b,auto c){return (b.first-a.first)*(c.second-a.second)-(b.second-a.second)*(c.first-a.first);};auto half=[&](auto points){vector<pair<long long,long long>>h;for(auto v:points){while(h.size()>=2&&cross(h[h.size()-2],h.back(),v)<=0)h.pop_back();h.push_back(v);}return h;};auto h=p;if(p.size()>1){h=half(p);h.pop_back();reverse(p.begin(),p.end());auto upper=half(p);upper.pop_back();h.insert(h.end(),upper.begin(),upper.end());}cout<<h.size()<<'\\n';for(auto v:h)cout<<v.first<<' '<<v.second<<'\\n';",
    'int n=sc.nextInt();TreeSet<Point>set=new TreeSet<>((a,b)->a.x==b.x?Long.compare(a.y,b.y):Long.compare(a.x,b.x));for(int i=0;i<n;i++)set.add(new Point(sc.nextLong(),sc.nextLong()));List<Point>p=new ArrayList<>(set),h=p;if(p.size()>1){h=half(p);h.remove(h.size()-1);Collections.reverse(p);List<Point>upper=half(p);upper.remove(upper.size()-1);h.addAll(upper);}System.out.println(h.size());for(Point v:h)System.out.println(v.x+" "+v.y);',
    "",
    "static class Point{long x,y;Point(long x,long y){this.x=x;this.y=y;}}static long cross(Point a,Point b,Point c){return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}static List<Point>half(List<Point>p){List<Point>h=new ArrayList<>();for(Point v:p){while(h.size()>=2&&cross(h.get(h.size()-2),h.get(h.size()-1),v)<=0)h.remove(h.size()-1);h.add(v);}return h;}",
  ),
});
const pyFFT =
  "import cmath\nn,m=ni(),ni();a=[ni() for _ in range(n)];b=[ni() for _ in range(m)];size=1\nwhile size<n+m-1: size*=2\ndef fft(a,inverse=False):\n    N=len(a);j=0\n    for i in range(1,N):\n        bit=N>>1\n        while j&bit: j^=bit;bit>>=1\n        j^=bit\n        if i<j: a[i],a[j]=a[j],a[i]\n    length=2\n    while length<=N:\n        root=cmath.exp((2j if inverse else -2j)*cmath.pi/length)\n        for start in range(0,N,length):\n            w=1\n            for j in range(length//2):\n                u=a[start+j];v=a[start+j+length//2]*w\n                a[start+j]=u+v;a[start+j+length//2]=u-v;w*=root\n        length*=2\n    if inverse:\n        for i in range(N): a[i]/=N\na+= [0]*(size-n);b+= [0]*(size-m);fft(a);fft(b)\nfor i in range(size): a[i]*=b[i]\nfft(a,True)\nprint(*[round(x.real) for x in a[:n+m-1]])";
const cppFFT =
  "void fft(vector<complex<double>>&a,bool inv){int n=a.size();for(int i=1,j=0;i<n;i++){int bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j)swap(a[i],a[j]);}for(int len=2;len<=n;len*=2){double angle=(inv?2:-2)*acos(-1)/len;complex<double>root(cos(angle),sin(angle));for(int s=0;s<n;s+=len){complex<double>w(1);for(int j=0;j<len/2;j++){auto u=a[s+j],v=a[s+j+len/2]*w;a[s+j]=u+v;a[s+j+len/2]=u-v;w*=root;}}}if(inv)for(auto&x:a)x/=n;}";
const javaFFT =
  "static void fft(double[]re,double[]im,boolean inv){int n=re.length;for(int i=1,j=0;i<n;i++){int bit=n>>1;for(;(j&bit)!=0;bit>>=1)j^=bit;j^=bit;if(i<j){double t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t;}}for(int len=2;len<=n;len*=2){double angle=(inv?2:-2)*Math.PI/len,rr=Math.cos(angle),ri=Math.sin(angle);for(int s=0;s<n;s+=len){double wr=1,wi=0;for(int j=0;j<len/2;j++){int u=s+j,v=u+len/2;double vr=re[v]*wr-im[v]*wi,vi=re[v]*wi+im[v]*wr;re[v]=re[u]-vr;im[v]=im[u]-vi;re[u]+=vr;im[u]+=vi;double next=wr*rr-wi*ri;wi=wr*ri+wi*rr;wr=next;}}}if(inv)for(int i=0;i<n;i++){re[i]/=n;im[i]/=n;}}";
mathPractice.push({
  topic: "fft",
  title: "FFT로 다항식 곱하기",
  statement:
    "두 다항식의 곱을 구하세요. 계수는 상수항부터 차수가 증가하는 순서입니다. 권장 코드는 길이를 2의 거듭제곱으로 늘려 FFT, 점별 곱, 역 FFT를 수행하고 정수로 반올림합니다.",
  input: "n m, 첫 다항식 n개 계수, 둘째 다항식 m개 계수",
  output: "n+m-1개의 정수 계수를 차수 순서대로 한 줄에 출력. 끝의 0도 유지",
  constraints: "1 ≤ n,m ≤ 64, 각 계수의 절댓값 ≤ 100",
  time: "O((n + m) log(n + m))",
  space: "O(n + m)",
  tests: cases(
    ["3 2\n1 2 3\n4 5\n", "4 13 22 15\n"],
    ["2 2\n1 -1\n1 1\n", "1 0 -1\n"],
    ["2 2\n0 2\n0 3\n", "0 0 6\n"],
    ["1 1\n-2\n3\n", "-6\n"],
  ),
  refs: programs(
    pyFFT,
    'int n,m;cin>>n>>m;int size=1;while(size<n+m-1)size*=2;vector<complex<double>>a(size),b(size);for(int i=0,x;i<n;i++){cin>>x;a[i]=x;}for(int i=0,x;i<m;i++){cin>>x;b[i]=x;}fft(a,false);fft(b,false);for(int i=0;i<size;i++)a[i]*=b[i];fft(a,true);for(int i=0;i<n+m-1;i++)cout<<(i?" ":"")<<llround(a[i].real());cout<<\'\\n\';',
    'int n=sc.nextInt(),m=sc.nextInt(),size=1;while(size<n+m-1)size*=2;double[]ar=new double[size],ai=new double[size],br=new double[size],bi=new double[size];for(int i=0;i<n;i++)ar[i]=sc.nextInt();for(int i=0;i<m;i++)br[i]=sc.nextInt();fft(ar,ai,false);fft(br,bi,false);for(int i=0;i<size;i++){double r=ar[i]*br[i]-ai[i]*bi[i];ai[i]=ar[i]*bi[i]+ai[i]*br[i];ar[i]=r;}fft(ar,ai,true);StringJoiner out=new StringJoiner(" ");for(int i=0;i<n+m-1;i++)out.add(""+Math.round(ar[i]));System.out.println(out);',
    cppFFT,
    javaFFT,
  ),
});
