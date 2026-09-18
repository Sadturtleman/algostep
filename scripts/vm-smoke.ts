import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {database} from '../apps/server/src/db.js';
import {seed} from '../apps/server/src/content.js';
import {runIsolated} from '../apps/runner/src/firecracker.js';
const db=await database();await seed(db);
try{for(const problem of (await db.query('SELECT * FROM problems ORDER BY id')).rows){for(const language of ['python','cpp','java'] as const){const job={id:randomUUID(),token:randomUUID(),language,source:problem.references_code[language],tests:problem.tests,limits:{testMs:10000,memoryBytes:536870912,compileMs:30000,outputBytes:65536,traceSteps:2000,submissionMs:120000}};const result=await runIsolated(job);console.log(problem.id,language,JSON.stringify(result.tests?.map((t:any)=>({verdict:t.verdict,elapsedMs:t.elapsedMs,traceSteps:t.trace?.length})))??JSON.stringify(result));assert.equal(result.verdict,'AC',JSON.stringify(result));if(language==='python')assert.ok(result.tests[0].trace.length>0);}}}finally{await db.close();}
