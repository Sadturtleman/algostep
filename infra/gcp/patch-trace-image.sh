#!/bin/bash
# Isolated, credential-free builder based on the previously verified host image.
set -euo pipefail
exec > >(tee /var/log/algostep-trace-build.log /dev/ttyS0) 2>&1
trap 'echo ALGOSTEP_TRACE_PATCH_FAILED; shutdown -h now' ERR
systemctl stop algostep-runner.service 2>/dev/null || true
cd /opt/algostep
python3 - <<'PY'
import urllib.request,pathlib
base='http://metadata.google.internal/computeMetadata/v1/instance/attributes/'
for key,path in [('algostep-tracer','/tmp/new-gdb-trace.py'),('algostep-probes','/tmp/cpp-probes.json')]:
    request=urllib.request.Request(base+key,headers={'Metadata-Flavor':'Google'})
    pathlib.Path(path).write_bytes(urllib.request.urlopen(request,timeout=30).read())
PY
test -f rootfs.ext4
test ! -L rootfs.ext4
chmod 0644 rootfs.ext4
mkdir -p /mnt/algostep-trace-root
mount -o loop rootfs.ext4 /mnt/algostep-trace-root
install -m 0644 /tmp/new-gdb-trace.py /mnt/algostep-trace-root/gdb_trace.py
umount /mnt/algostep-trace-root
chmod 0444 rootfs.ext4
cat >/opt/algostep/trace-image-check.mjs <<'JS'
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runIsolated} from './apps/runner/src/firecracker.ts';
const probes=JSON.parse(await readFile('/tmp/cpp-probes.json','utf8'));
let cursor=0,total=0;
async function worker(){
 while(cursor<probes.length){
 const p=probes[cursor++];
 const r=await runIsolated({id:randomUUID(),token:randomUUID(),language:'cpp',source:p.source,tests:p.tests,limits:{testMs:10000,memoryBytes:536870912,compileMs:30000,outputBytes:65536,traceSteps:2000,submissionMs:120000}});
 assert.equal(r.verdict,'AC',p.id+' '+JSON.stringify(r));
 assert.equal(r.tests.length,p.tests.length);
 for(const [i,t] of r.tests.entries()){assert.ok(t.trace.length>0,p.id+' test '+i+' missing trace');total++;}
 console.log(JSON.stringify({problem:p.id,verdict:r.verdict,frames:r.tests.map(t=>t.trace.length),truncated:r.tests.map(t=>t.traceTruncated)}));
 }
}
await Promise.all([worker(),worker()]);
console.log('CPP_TRACE_VERIFIED '+total+' tests');
JS
env KERNEL_PATH=/opt/algostep/vmlinux ROOTFS_PATH=/opt/algostep/rootfs.ext4 RUNNER_WORKDIR=/var/lib/algostep node --import tsx trace-image-check.mjs
sha256sum vmlinux rootfs.ext4
echo ALGOSTEP_TRACE_PATCH_VERIFIED
shutdown -h now

