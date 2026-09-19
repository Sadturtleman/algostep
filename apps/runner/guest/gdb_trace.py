import gdb, json, time
steps=[]
seen=set()
encoded=[]
trace_bytes=2
cut=False
deadline=time.monotonic()+6

def checkpoint(truncated):
    # The outer process may enforce its deadline with SIGKILL. Preserve an
    # already bounded prefix while tracing, not only at normal debugger exit.
    with open('/tmp/work/trace.json','w') as f:f.write('['+','.join(encoded)+']')
    if truncated:
        with open('/tmp/work/trace-truncated','w') as f:f.write('1')

def append_step(step):
    global trace_bytes,cut
    raw=json.dumps(step,ensure_ascii=True,allow_nan=False)
    if trace_bytes+len(raw)+1>60000:
        cut=True
        return False
    steps.append(step);encoded.append(raw);trace_bytes+=len(raw)+1
    if len(steps)%8==0:checkpoint(True)
    return True
def safe(value,depth=0):
    if depth>5:return '[depth limit]'
    try:
        t=value.type.strip_typedefs()
        if t.code in (gdb.TYPE_CODE_INT,gdb.TYPE_CODE_ENUM,gdb.TYPE_CODE_BOOL):return int(value)
        if t.code==gdb.TYPE_CODE_FLT:return float(value)
        if t.code==gdb.TYPE_CODE_ARRAY:
            lo,hi=t.range();return [safe(value[i],depth+1) for i in range(lo,min(hi+1,lo+30))]
        if t.code in (gdb.TYPE_CODE_PTR,gdb.TYPE_CODE_REF):
            if t.code==gdb.TYPE_CODE_PTR and int(value)==0:return None
            target=value.dereference()
            if target.type.strip_typedefs().code==gdb.TYPE_CODE_STRUCT:return safe(target,depth+1)
        printer=gdb.default_visualizer(value)
        if printer and hasattr(printer,'children'):
            result=[]
            for _,child in printer.children():
                result.append(safe(child,depth+1))
                if len(result)>=30:break
            return result
        if t.code==gdb.TYPE_CODE_STRUCT and not str(t).startswith('std::'):
            identity='cpp@'+str(value.address)
            if identity in seen:return {'$ref':identity}
            seen.add(identity)
            fields={}
            for f in t.fields()[:30]:
                if f.name and not f.is_base_class:fields[f.name]=safe(value[f.name],depth+1)
            return {'$id':identity,'$type':str(t),'fields':fields}
        return str(value)[:120]
    except Exception:return '[unavailable]'
def capture():
    seen.clear()
    frame=gdb.selected_frame();sal=frame.find_sal()
    if not sal.symtab or not sal.symtab.filename.endswith('main.cpp'):return
    variables={};block=frame.block()
    while block:
        for symbol in block:
            if (symbol.is_variable or symbol.is_argument) and symbol.name not in variables and len(variables)<40:
                try:variables[symbol.name]=safe(symbol.value(frame))
                except Exception:pass
        block=block.superblock
    stack=[];f=frame
    while f and len(stack)<32:
        if f.find_sal().symtab and f.find_sal().symtab.filename.endswith('main.cpp'):stack.append((f.name() or '?')[:120])
        f=f.older()
    append_step({'line':sal.line,'event':'line','locals':variables,'stack':stack})
try:
    gdb.execute('set pagination off');gdb.execute('set confirm off');gdb.execute('set print elements 30')
    gdb.execute('set exec-wrapper /single-thread')
    gdb.execute('skip -gfi /usr/include/*');gdb.execute('skip -gfi /usr/lib/*')
    gdb.execute('break main')
    gdb.execute('run < /tmp/work/stdin > /tmp/work/debug-out 2> /tmp/work/debug-err',to_string=True)
    while len(steps)<2000 and not cut and gdb.selected_inferior().pid:
        capture()
        if cut or time.monotonic()>=deadline:
            cut=True
            break
        gdb.execute('step',to_string=True)
except Exception:pass
finally:
    cut=cut or len(steps)>=2000
    checkpoint(cut)
    if not cut:
        import os
        try:os.unlink('/tmp/work/trace-truncated')
        except FileNotFoundError:pass
