import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {database} from '../apps/server/src/db.js';
import {seed} from '../apps/server/src/content.js';
import {runIsolated} from '../apps/runner/src/firecracker.js';
const db=await database();await seed(db);
try{if(process.env.BOUNDARY_ONLY!=='1')for(const problem of (await db.query('SELECT * FROM problems ORDER BY id')).rows){for(const language of ['python','cpp','java'] as const){const job={id:randomUUID(),token:randomUUID(),language,source:problem.references_code[language],tests:problem.tests,limits:{testMs:10000,memoryBytes:536870912,compileMs:30000,outputBytes:65536,traceSteps:2000,submissionMs:120000}};const result=await runIsolated(job);console.log(problem.id,language,JSON.stringify(result.tests?.map((t:any)=>({verdict:t.verdict,elapsedMs:t.elapsedMs,traceSteps:t.trace?.length})))??JSON.stringify(result));assert.equal(result.verdict,'AC',JSON.stringify(result));assert.ok(result.tests[0].trace.length>0,language+' trace missing');}}
const cases=[
  {name:'strict-newline',source:'print("ok", end="")',expected:'ok\n',verdict:'WA'},
  {name:'runtime-exception',source:'raise ValueError("learning error")',expected:'',verdict:'RE'},
  {name:'time-limit',source:'while True: pass',expected:'',verdict:'TLE'},
  {name:'memory-limit',source:'a = bytearray(600 * 1024 * 1024)',expected:'',verdict:'MLE'},
  {name:'output-limit',source:'print("x" * 100000)',expected:'',verdict:'OUTPUT_LIMIT'},
  {name:'stdout-spoof',source:'open("stdout","w").write("expected\\n")\nprint("wrong")\n',expected:'expected\n',verdict:'WA'},
  {name:'source-isolation',source:'import os\nos.remove("main.py")\nopen("main.py","w").write("print(\\\"changed\\\")")\nprint("clean")\n',expected:'clean\n',verdict:'AC'},
  {name:'network-isolation',source:'import socket\ntry:\n    socket.create_connection(("1.1.1.1", 80), timeout=1)\n    print("connected")\nexcept OSError:\n    print("isolated")\n',expected:'isolated\n',verdict:'AC'}
];
for(const sample of cases){const result=await runIsolated({id:randomUUID(),token:randomUUID(),language:'python',source:sample.source,tests:Array.from({length:sample.name==='source-isolation'?2:1},()=>({input:'',expected:sample.expected})),limits:{testMs:10000,memoryBytes:536870912,compileMs:30000,outputBytes:65536,traceSteps:2000,submissionMs:120000}});console.log('boundary',sample.name,result.verdict);assert.equal(result.verdict,sample.verdict,JSON.stringify(result));}
const objects={python:'class Node:\n    def __init__(self):\n        self.value=7\n        self.next=self\nhead=Node()\nalias=head\nprint(head.value)\n',cpp:'#include <iostream>\nstruct Node {int value;Node* next;};\nint main(){Node head{7,nullptr};\nhead.next=&head;Node* alias=&head;\nstd::cout<<head.value<<"\\n";\n}\n',java:'public class Main {static class Node {int value=7;Node next;} public static void main(String[] args){\nNode head=new Node();\nhead.next=head;Node alias=head;\nSystem.out.println(head.value);\n}}\n'};
const threadPrograms={python:'import threading\nt=threading.Thread(target=lambda:print("thread"))\nt.start()\nt.join()\n',cpp:'#include <thread>\nint main(){std::thread t([]{});t.join();}\n',java:'public class Main {public static void main(String[] args) throws Exception {Thread t=new Thread(()->{});t.start();t.join();}}\n'};
for(const language of ['python','cpp','java'] as const){
 const invoke=(source:string)=>runIsolated({id:randomUUID(),token:randomUUID(),language,source,tests:[{input:'',expected:'7\n'}],limits:{testMs:10000,memoryBytes:536870912,compileMs:30000,outputBytes:65536,traceSteps:2000,submissionMs:120000}});
 const object=await invoke(objects[language]);assert.equal(object.verdict,'AC',JSON.stringify(object));assert.match(JSON.stringify(object.tests[0].trace),/\$id/);assert.match(JSON.stringify(object.tests[0].trace),/\$ref/);console.log('object-identity',language,'PASS');
 const thread=await invoke(threadPrograms[language]);assert.equal(thread.verdict,'RE',JSON.stringify(thread));console.log('single-thread',language,'PASS');
}
}finally{await db.close();}
