"""Trusted VM guest supervisor. Host never launches a submitted program."""
import os, sys, json, socket, subprocess, resource, signal, time, pathlib, shutil
WORK=pathlib.Path('/tmp/work')
IO=pathlib.Path('/tmp/supervisor-io')
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
    IO.mkdir(mode=0o700,exist_ok=True)
    inp=IO/'stdin'; inp.write_text(stdin)
    (WORK/'stdin').write_text(stdin)
    start=time.monotonic(); timed_out=False
    with open(inp,'rb') as inf,open(IO/'stdout','wb') as out,open(IO/'stderr','wb') as err:
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
    raw=(IO/'stdout').read_bytes()[:output_limit]
    stdout=raw.decode('utf-8',errors='replace')
    stderr=(IO/'stderr').read_bytes()[:output_limit].decode('utf-8',errors='replace')
    status='TLE' if timed_out else 'MLE' if oom else 'OUTPUT_LIMIT' if (IO/'stdout').stat().st_size>=output_limit or (IO/'stderr').stat().st_size>=output_limit else 'RE' if p.returncode else 'OK'
    for _ in range(100):
        try:group.rmdir();break
        except OSError:time.sleep(.01)
    return status,stdout,stderr,elapsed,peak,raw
def execute(job):
    WORK.mkdir(exist_ok=True);os.chown(WORK,65534,65534)
    lang=job['language'];name={'python':'main.py','cpp':'main.cpp','java':'Main.java'}[lang]
    (WORK/name).write_text(job['source'],encoding='utf-8')
    limit=job['limits'];memory=limit['memoryBytes'];tests=[]
    if lang!='python':
        cmd=['g++','-std=c++20','-O0','-g','main.cpp','-o','main'] if lang=='cpp' else ['javac','-g','-J-Xmx256m','Main.java']
        status,out,err,ms,peak,_raw=run(cmd,'',limit['compileMs']/1000,limit['outputBytes'],memory,compiling=True)
        if status!='OK':return {'verdict':'CE','diagnostics':err or status,'tests':[],'traceSupport':'UNSUPPORTED','runnerImage':IMAGE}
    artifacts=pathlib.Path('/tmp/trusted-artifacts');artifacts.mkdir(mode=0o700,exist_ok=True)
    for entry in WORK.iterdir():
        if entry.is_file() and not entry.is_symlink() and (entry.name==name or (lang=='cpp' and entry.name=='main') or (lang=='java' and entry.suffix=='.class')):shutil.copyfile(entry,artifacts/entry.name)
    def restore():
        # A submitted program may replace any path in its writable directory.
        # Remove the whole directory before trusted supervisor I/O, including symlinks.
        shutil.rmtree(WORK);WORK.mkdir();os.chown(WORK,65534,65534)
        for entry in artifacts.iterdir():
            target=WORK/entry.name;shutil.copyfile(entry,target);target.chmod(0o755 if entry.name=='main' else 0o644)
    command={'python':['/single-thread','python3.10','-I','-S','main.py'],'cpp':['/single-thread','./main'],'java':['java','-Djava.security.manager=allow','-cp','/opt/policy:/tmp/work','-Xmx256m','-XX:MaxMetaspaceSize=128m','-XX:ReservedCodeCacheSize=32m','-XX:+UseSerialGC','-XX:ActiveProcessorCount=1','SingleThreadMain']}[lang]
    for case in job['tests']:
        restore()
        # Remove mutable user files between tests; preserve only submitted source and compiled artifacts.
        for entry in WORK.iterdir():
            if entry.name==name or (lang=='cpp' and entry.name=='main') or (lang=='java' and entry.suffix=='.class'):continue
            if entry.is_dir() and not entry.is_symlink():shutil.rmtree(entry)
            else:entry.unlink()
        status,out,err,ms,peak,raw=run(command,case['input'],limit['testMs']/1000,limit['outputBytes'],memory)
        expected=case['expected'];verdict=status if status!='OK' else 'COMPLETED' if expected is None else 'AC' if raw==expected.encode('utf-8') else 'WA'
        trace=[]
        if status in ('OK','RE'):
            restore()
            debug={'python':['/single-thread','python3.10','-I','-S','/trace.py'],'cpp':['gdb','-q','-batch','-x','/gdb_trace.py','./main'],'java':['java','-Xmx128m','-XX:+UseSerialGC','--add-modules','jdk.jdi','-cp','/opt/tracer','JdiTrace']}[lang]
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
    # PID 1 exiting immediately can reset vsock before Firecracker delivers its
    # buffered response. Keep the guest alive until the host consumes and closes.
    connection.settimeout(5)
    try:
        while connection.recv(1024):pass
    except OSError:pass
server.close()
