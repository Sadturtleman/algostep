import type { DB } from "./db.js";
import { formatReference } from './reference-format.js';
type Spec = {
  id: string;
  topic: string;
  title: string;
  statement: string;
  time: string;
  space: string;
  py: string;
  cpp: string;
  java: string;
  tests: { input: string; expected: string }[];
};
const sortingTests = [
  { input: "5\n3 -1 3 0 2\n", expected: "-1 0 2 3 3\n" },
  { input: "1\n7\n", expected: "7\n" },
  { input: "4\n4 3 2 1\n", expected: "1 2 3 4\n" },
];
const sorts = [
  [
    "bubble-sort",
    "버블 정렬",
    `for end in range(n-1,0,-1):\n    for j in range(end):\n        if a[j] > a[j+1]: a[j],a[j+1]=a[j+1],a[j]`,
    `for(int end=n-1;end>0;--end)for(int j=0;j<end;++j)if(a[j]>a[j+1])swap(a[j],a[j+1]);`,
    `for(int end=n-1;end>0;--end)for(int j=0;j<end;++j)if(a[j]>a[j+1]){long t=a[j];a[j]=a[j+1];a[j+1]=t;}`,
    "O(n²)",
  ],
  [
    "selection-sort",
    "선택 정렬",
    `for i in range(n):\n    k=i\n    for j in range(i+1,n):\n        if a[j]<a[k]: k=j\n    a[i],a[k]=a[k],a[i]`,
    `for(int i=0;i<n;++i){int k=i;for(int j=i+1;j<n;++j)if(a[j]<a[k])k=j;swap(a[i],a[k]);}`,
    `for(int i=0;i<n;++i){int k=i;for(int j=i+1;j<n;++j)if(a[j]<a[k])k=j;long t=a[i];a[i]=a[k];a[k]=t;}`,
    "O(n²)",
  ],
  [
    "insertion-sort",
    "삽입 정렬",
    `for i in range(1,n):\n    key=a[i]; j=i-1\n    while j>=0 and a[j]>key:\n        a[j+1]=a[j]; j-=1\n    a[j+1]=key`,
    `for(int i=1;i<n;++i){long long key=a[i];int j=i-1;while(j>=0&&a[j]>key){a[j+1]=a[j];--j;}a[j+1]=key;}`,
    `for(int i=1;i<n;++i){long key=a[i];int j=i-1;while(j>=0&&a[j]>key){a[j+1]=a[j];--j;}a[j+1]=key;}`,
    "O(n²)",
  ],
  [
    "merge-sort",
    "병합 정렬",
    `def sort(l,r):\n    if r-l<2:return\n    m=(l+r)//2;sort(l,m);sort(m,r)\n    out=[];i=l;j=m\n    while i<m and j<r:\n        if a[i]<=a[j]:out.append(a[i]);i+=1\n        else:out.append(a[j]);j+=1\n    out.extend(a[i:m]);out.extend(a[j:r]);a[l:r]=out\nsort(0,n)`,
    `function<void(int,int)> sortRange=[&](int l,int r){if(r-l<2)return;int m=(l+r)/2;sortRange(l,m);sortRange(m,r);vector<long long> out;int i=l,j=m;while(i<m&&j<r){if(a[i]<=a[j])out.push_back(a[i++]);else out.push_back(a[j++]);}while(i<m)out.push_back(a[i++]);while(j<r)out.push_back(a[j++]);copy(out.begin(),out.end(),a.begin()+l);};sortRange(0,n);`,
    `for(int width=1;width<n;width*=2){long[] b=a.clone();for(int l=0;l<n;l+=2*width){int m=Math.min(l+width,n),r=Math.min(l+2*width,n),i=l,j=m;for(int k=l;k<r;k++){if(i<m&&(j>=r||a[i]<=a[j]))b[k]=a[i++];else b[k]=a[j++];}}a=b;}`,
    "O(n log n)",
  ],
  [
    "quick-sort",
    "퀵 정렬",
    `def sort(l,r):\n    if l>=r:return\n    pivot=a[(l+r)//2];i=l;j=r\n    while i<=j:\n        while a[i]<pivot:i+=1\n        while a[j]>pivot:j-=1\n        if i<=j:a[i],a[j]=a[j],a[i];i+=1;j-=1\n    if l<j:sort(l,j)\n    if i<r:sort(i,r)\nsort(0,n-1)`,
    `function<void(int,int)> sortRange=[&](int l,int r){if(l>=r)return;long long p=a[(l+r)/2];int i=l,j=r;while(i<=j){while(a[i]<p)++i;while(a[j]>p)--j;if(i<=j)swap(a[i++],a[j--]);}if(l<j)sortRange(l,j);if(i<r)sortRange(i,r);};sortRange(0,n-1);`,
    `Deque<int[]> ranges=new ArrayDeque<>();ranges.push(new int[]{0,n-1});while(!ranges.isEmpty()){int[] range=ranges.pop();int l=range[0],r=range[1];if(l>=r)continue;long p=a[(l+r)/2];int i=l,j=r;while(i<=j){while(a[i]<p)i++;while(a[j]>p)j--;if(i<=j){long t=a[i];a[i++]=a[j];a[j--]=t;}}if(l<j)ranges.push(new int[]{l,j});if(i<r)ranges.push(new int[]{i,r});}`,
    "최악 O(n²)",
  ],
] as const;
const specs: Spec[] = sorts.map(([topic, title, py, cpp, java, time]) => ({
  id: topic + "-v1",
  topic,
  title: title + "로 정렬하기",
  statement:
    "주어진 정수들을 오름차순으로 정렬하세요. 중복 값도 유지합니다. 권장 코드는 " +
    title +
    "을 사용합니다.",
  time,
  space: "O(n)",
  py,
  cpp,
  java,
  tests: sortingTests,
}));
specs.push(
  {
    id: "prefix-sum-v1",
    topic: "prefix-sum",
    title: "모든 접두사 합",
    statement: "각 위치까지의 누적 합을 순서대로 출력하세요.",
    time: "O(n)",
    space: "O(n)",
    py: "for i in range(1,n):a[i]+=a[i-1]",
    cpp: "for(int i=1;i<n;++i)a[i]+=a[i-1];",
    java: "for(int i=1;i<n;++i)a[i]+=a[i-1];",
    tests: [
      { input: "4\n2 -1 3 0\n", expected: "2 1 4 4\n" },
      { input: "1\n-5\n", expected: "-5\n" },
    ],
  },
  {
    id: "hash-v1",
    topic: "hash",
    title: "등장 순서로 중복 제거",
    statement: "처음 등장하는 정수만 순서대로 출력하세요.",
    time: "평균 O(n), 최악 O(n²)",
    space: "O(n)",
    py: "seen=set();out=[]\nfor x in a:\n    if x not in seen:seen.add(x);out.append(x)\na=out",
    cpp: "unordered_set<long long> seen;vector<long long> out;for(auto x:a)if(seen.insert(x).second)out.push_back(x);a=out;",
    java: "Set<Long> seen=new HashSet<>();int size=0;for(long x:a)if(seen.add(x))a[size++]=x;a=Arrays.copyOf(a,size);",
    tests: [
      { input: "6\n2 2 1 3 1 2\n", expected: "2 1 3\n" },
      { input: "1\n0\n", expected: "0\n" },
    ],
  },
  {
    id: "stack-v1",
    topic: "stack",
    title: "스택으로 역순 출력",
    statement: "정수를 차례로 스택에 넣고 하나씩 꺼낸 순서로 출력하세요.",
    time: "O(n)",
    space: "O(n)",
    py: "stack=[]\nfor x in a:stack.append(x)\na=[]\nwhile stack:a.append(stack.pop())",
    cpp: "stack<long long> s;for(auto x:a)s.push(x);a.clear();while(!s.empty()){a.push_back(s.top());s.pop();}",
    java: "Deque<Long> stack=new ArrayDeque<>();for(long x:a)stack.push(x);for(int i=0;i<n;++i)a[i]=stack.pop();",
    tests: [
      { input: "3\n1 2 3\n", expected: "3 2 1\n" },
      { input: "1\n9\n", expected: "9\n" },
    ],
  },
  {
    id: "queue-v1",
    topic: "queue",
    title: "큐의 처리 순서",
    statement: "정수를 차례로 큐에 넣고 큐에서 하나씩 꺼내 출력하세요.",
    time: "O(n)",
    space: "O(n)",
    py: "from collections import deque\nq=deque(a);a=[]\nwhile q:a.append(q.popleft())",
    cpp: "queue<long long> q;for(auto x:a)q.push(x);a.clear();while(!q.empty()){a.push_back(q.front());q.pop();}",
    java: "Deque<Long> q=new ArrayDeque<>();for(long x:a)q.addLast(x);for(int i=0;i<n;++i)a[i]=q.removeFirst();",
    tests: [
      { input: "3\n5 1 7\n", expected: "5 1 7\n" },
      { input: "1\n0\n", expected: "0\n" },
    ],
  },
  {
    id: "heap-v1",
    topic: "heap",
    title: "최소 힙에서 차례로 꺼내기",
    statement: "정수들을 최소 힙에 넣고 최솟값을 반복해서 꺼내 출력하세요.",
    time: "O(n log n)",
    space: "O(n)",
    py: "import heapq\nheapq.heapify(a);out=[]\nwhile a:out.append(heapq.heappop(a))\na=out",
    cpp: "priority_queue<long long,vector<long long>,greater<long long>> q;for(auto x:a)q.push(x);a.clear();while(!q.empty()){a.push_back(q.top());q.pop();}",
    java: "PriorityQueue<Long> q=new PriorityQueue<>();for(long x:a)q.add(x);for(int i=0;i<n;++i)a[i]=q.remove();",
    tests: sortingTests,
  },
  {
    id: "two-pointer-v1",
    topic: "two-pointer",
    title: "정렬된 배열의 서로 다른 값",
    statement:
      "오름차순 정렬 배열의 중복을 제거하여 서로 다른 값을 출력하세요. 권장 코드는 읽기·쓰기 포인터를 사용합니다.",
    time: "O(n)",
    space: "O(n)",
    py: "write=0\nfor read in range(n):\n    if write==0 or a[read]!=a[write-1]:a[write]=a[read];write+=1\na=a[:write]",
    cpp: "int w=0;for(int r=0;r<n;++r)if(w==0||a[r]!=a[w-1])a[w++]=a[r];a.resize(w);",
    java: "int w=0;for(int r=0;r<n;++r)if(w==0||a[r]!=a[w-1])a[w++]=a[r];a=Arrays.copyOf(a,w);",
    tests: [
      { input: "6\n1 1 2 2 2 4\n", expected: "1 2 4\n" },
      { input: "1\n-1\n", expected: "-1\n" },
    ],
  },
  {
    id: "tabulation-v1",
    topic: "tabulation",
    title: "최대 연속 부분합",
    statement:
      "비어 있지 않은 연속 부분 배열의 최대 합을 출력하세요. 권장 코드는 현재 위치에서 끝나는 최대 합을 갱신합니다.",
    time: "O(n)",
    space: "O(n)",
    py: "best=cur=a[0]\nfor x in a[1:]:\n    cur=max(x,cur+x);best=max(best,cur)\na=[best]",
    cpp: "long long best=a[0],cur=a[0];for(int i=1;i<n;++i){cur=max(a[i],cur+a[i]);best=max(best,cur);}a={best};",
    java: "long best=a[0],cur=a[0];for(int i=1;i<n;++i){cur=Math.max(a[i],cur+a[i]);best=Math.max(best,cur);}a=new long[]{best};",
    tests: [
      { input: "6\n-2 3 -1 4 -6 2\n", expected: "6\n" },
      { input: "3\n-5 -1 -3\n", expected: "-1\n" },
    ],
  },
);
export async function seedPractice(db: DB) {
  for (const s of specs) {
    const refs = {
      python: `n=int(input())\na=list(map(int,input().split()))\n${s.py}\nprint(*a)\n`,
      cpp: `#include <iostream>\n#include <vector>\n#include <algorithm>\n#include <functional>\n#include <unordered_set>\n#include <queue>\n#include <stack>\nusing namespace std;\nint main(){int n;cin>>n;vector<long long> a(n);for(auto &x:a)cin>>x;\n${s.cpp}\nfor(int i=0;i<(int)a.size();++i){if(i)cout<<' ';cout<<a[i];}cout<<'\\n';}\n`,
      java: `import java.util.*;\npublic class Main { public static void main(String[] args){Scanner sc=new Scanner(System.in);int n=sc.nextInt();long[] a=new long[n];for(int i=0;i<n;++i)a[i]=sc.nextLong();\n${s.java}\nStringJoiner out=new StringJoiner(" ");for(long x:a)out.add(""+x);System.out.println(out);}}\n`,
    };
    refs.cpp=formatReference(refs.cpp);
    refs.java=formatReference(refs.java);
    await db.query(
      "INSERT INTO problems(id,topic_id,version,title,statement,input_spec,output_spec,constraints_text,tests,references_code,starters,complexity_time,complexity_space) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING",
      [
        s.id,
        s.topic,
        s.title,
        s.statement,
        "첫 줄 n, 둘째 줄 n개의 정수",
        "결과 정수들을 공백 하나로 구분한 뒤 줄바꿈",
        "1 ≤ n ≤ 500, |a[i]| ≤ 1000000" +
          (s.topic === "two-pointer" ? ", 배열은 오름차순" : ""),
        JSON.stringify(s.tests),
        JSON.stringify(refs),
        JSON.stringify({
          python: "# 전체 프로그램을 작성하세요.\n",
          cpp: "#include <iostream>\nint main() {\n}\n",
          java: "public class Main { public static void main(String[] args) {\n}\n}\n",
        }),
        s.time,
        s.space,
      ],
    );
  }
}
