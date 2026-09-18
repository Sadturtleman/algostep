"""Trusted VM guest supervisor. Host never launches a submitted program."""
import os, sys, json, socket, subprocess, resource, signal, time, pathlib, shutil
WORK=pathlib.Path('/tmp/work')
IMAGE='ubuntu22-python3.10-gcc-cpp20-openjdk21-v1'
def run(command, stdin, timeout, output_limit, memory, compiling=False):
    group=pathlib.Path('/sys/fs/cgroup/submission')
    group.mkdir(exist_ok=True)
    (group/'memory.max').write_text(str(memory))
    (group/'memory.swap.max').write_text('0')
    (group/'pids.max').write_text('64')
    def restrict():
        (group/'cgroup.procs').write_text(str(os.getpid()))
        os.setsid()
        file_limit=16777216 if compiling else output_limit
        resource.setrlimit(resource.RLIMIT_FSIZE,(file_limit,file_limit))
        resource.setrlimit(resource.RLIMIT_NOFILE,(64,64))
        resource.setrlimit(resource.RLIMIT_CORE,(0,0))
        # Guest uid has no capabilities. No network interface is attached to the VM.
        os.setgroups([]);os.setgid(65534);os.setuid(65534)
    inp=WORK/'stdin'; inp.write_text(stdin)
    start=time.monotonic(); timed_out=False
    with open(inp,'rb') as inf,open(WORK/'stdout','wb') as out,open(WORK/'stderr','wb') as err:
        p=subprocess.Popen(command,cwd=WORK,stdin=inf,stdout=out,stderr=err,preexec_fn=restrict,env={'PATH':'/usr/bin:/bin','HOME':'/tmp/work','LANG':'C.UTF-8','PYTHONDONTWRITEBYTECODE':'1'})
        try:p.wait(timeout=timeout)
        except subprocess.TimeoutExpired:timed_out=True;os.killpg(p.pid,signal.SIGKILL);p.wait()
        finally:
            # Kill descendants, including processes which escaped the process group.
            try:(group/'cgroup.kill').write_text('1')
            except FileNotFoundError:pass
    elapsed=round((time.monotonic()-start)*1000)
    peak=int((group/'memory.peak').read_text())
    oom='oom_kill 0' not in (group/'memory.events').read_text()
    stdout=(WORK/'stdout').read_bytes()[:output_limit].decode('utf-8',errors='replace')
    stderr=(WORK/'stderr').read_bytes()[:output_limit].decode('utf-8',errors='replace')
    status='TLE' if timed_out else 'MLE' if oom else 'OUTPUT_LIMIT' if (WORK/'stdout').stat().st_size>=output_limit or (WORK/'stderr').stat().st_size>=output_limit else 'RE' if p.returncode else 'OK'
    for _ in range(100):
        try:group.rmdir();break
        except OSError:time.sleep(.01)
    return status,stdout,stderr,elapsed,peak
def execute(job):
    WORK.mkdir(exist_ok=True);os.chown(WORK,65534,65534)
    lang=job['language'];name={'python':'main.py','cpp':'main.cpp','java':'Main.java'}[lang]
    (WORK/name).write_text(job['source'],encoding='utf-8')
    limit=job['limits'];memory=limit['memoryBytes'];tests=[]
    if lang!='python':
        cmd=['g++','-std=c++20','-O0','-g','main.cpp','-o','main'] if lang=='cpp' else ['javac','-g','-J-Xmx256m','Main.java']
        status,out,err,ms,peak=run(cmd,'',limit['compileMs']/1000,limit['outputBytes'],memory,compiling=True)
        if status!='OK':return {'verdict':'CE','diagnostics':err or status,'tests':[],'traceSupport':'UNSUPPORTED','runnerImage':IMAGE}
    command={'python':['python3.10','main.py'],'cpp':['./main'],'java':['java','-Xmx256m','-XX:MaxMetaspaceSize=128m','-XX:ReservedCodeCacheSize=32m','-XX:+UseSerialGC','-XX:ActiveProcessorCount=1','Main']}[lang]
    for case in job['tests']:
        # Remove mutable user files between tests; preserve only submitted source and compiled artifacts.
        for entry in WORK.iterdir():
            if entry.name==name or (lang=='cpp' and entry.name=='main') or (lang=='java' and entry.suffix=='.class'):continue
            if entry.is_dir() and not entry.is_symlink():shutil.rmtree(entry)
            else:entry.unlink()
        status,out,err,ms,peak=run(command,case['input'],limit['testMs']/1000,limit['outputBytes'],memory)
        expected=case['expected'];verdict=status if status!='OK' else 'COMPLETED' if expected is None else 'AC' if out==expected else 'WA'
        trace=[]
        if status=='OK':
            debug={'python':['python3.10','/trace.py'],'cpp':['gdb','-q','-batch','-x','/gdb_trace.py','./main'],'java':['java','-Xmx128m','-XX:+UseSerialGC','--add-modules','jdk.jdi','-cp','/opt/tracer','JdiTrace']}[lang]
            # Separate tracing run; never use debugger timing or output for judging.
            run(debug,case['input'],limit['testMs']/1000,limit['outputBytes'],memory)
            try:
                raw=(WORK/'trace.json').read_bytes()
                if len(raw)<=800000:trace=json.loads(raw)
            except (OSError,ValueError):pass
        tests.append({'input':case['input'],'expected':expected,'actual':out,'stderr':err,'verdict':verdict,'elapsedMs':ms,'peakMemoryBytes':peak,'trace':trace,'traceTruncated':len(trace)>=limit['traceSteps'] or (WORK/'trace-truncated').exists()})
    verdict=next((x['verdict'] for x in tests if x['verdict'] not in ('AC','COMPLETED')),'COMPLETED' if any(x['expected'] is None for x in tests) else 'AC')
    return {'verdict':verdict,'tests':tests,'traceSupport':{'python':'PYTHON','cpp':'GDB','java':'JDI'}[lang],'runnerImage':IMAGE}
server=socket.socket(socket.AF_VSOCK,socket.SOCK_STREAM);server.bind((socket.VMADDR_CID_ANY,5000));server.listen(1)
connection,_=server.accept()
with connection:
    reader=connection.makefile('rb');line=reader.readline(1024*1024)
    job=json.loads(line)
    try:result=execute(job);connection.sendall(json.dumps(result,ensure_ascii=True,allow_nan=False).encode()+b'\n')
    except Exception:connection.sendall(b'{"error":"GUEST_AGENT_FAILED"}\n')
server.close()
