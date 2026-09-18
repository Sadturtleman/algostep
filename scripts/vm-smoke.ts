import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {database} from '../apps/server/src/db.js';
import {seed} from '../apps/server/src/content.js';
import {runIsolated} from '../apps/runner/src/firecracker.js';
const db=await database();await seed(db);
try{for(const problem of (await db.query('SELECT * FROM problems ORDER BY id')).rows){for(const language of ['python','cpp','java'] as const){const job={id:randomUUID(),token:randomUUID(),language,source:problem.references_code[language],tests:problem.tests,limits:{testMs:10000,memoryBytes:536870912,compileMs:30000,outputBytes:65536,traceSteps:2000,submissionMs:120000}};const result=await runIsolated(job);console.log(problem.id,language,JSON.stringify(result.tests?.map((t:any)=>({verdict:t.verdict,elapsedMs:t.elapsedMs,traceSteps:t.trace?.length})))??JSON.stringify(result));assert.equal(result.verdict,'AC',JSON.stringify(result));assert.ok(result.tests[0].trace.length>0,language+' trace missing');}}
const cases=[
  {name:'strict-newline',source:'print("ok", end="")',expected:'ok\n',verdict:'WA'},
  {name:'runtime-exception',source:'raise ValueError("learning error")',expected:'',verdict:'RE'},
  {name:'time-limit',source:'while True: pass',expected:'',verdict:'TLE'},
  {name:'memory-limit',source:'a = bytearray(600 * 1024 * 1024)',expected:'',verdict:'MLE'},
  {name:'output-limit',source:'print("x" * 100000)',expected:'',verdict:'OUTPUT_LIMIT'},
  {name:'network-isolation',source:'import socket\ntry:\n    socket.create_connection(("1.1.1.1", 80), timeout=1)\n    print("connected")\nexcept OSError:\n    print("isolated")\n',expected:'isolated\n',verdict:'AC'}
];
for(const sample of cases){const result=await runIsolated({id:randomUUID(),token:randomUUID(),language:'python',source:sample.source,tests:[{input:'',expected:sample.expected}],limits:{testMs:10000,memoryBytes:536870912,compileMs:30000,outputBytes:65536,traceSteps:2000,submissionMs:120000}});console.log('boundary',sample.name,result.verdict);assert.equal(result.verdict,sample.verdict,JSON.stringify(result));}
}finally{await db.close();}
