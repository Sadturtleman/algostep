import gdb, json
steps=[]
seen=set()
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
    steps.append({'line':sal.line,'event':'line','locals':variables,'stack':stack})
try:
    gdb.execute('set pagination off');gdb.execute('set confirm off');gdb.execute('set print elements 30')
    gdb.execute('set exec-wrapper /single-thread')
    gdb.execute('skip -gfi /usr/include/*');gdb.execute('skip -gfi /usr/lib/*')
    gdb.execute('break main')
    gdb.execute('run < /tmp/work/stdin > /tmp/work/debug-out 2> /tmp/work/debug-err',to_string=True)
    while len(steps)<2000 and gdb.selected_inferior().pid:
        capture()
        gdb.execute('step',to_string=True)
except Exception:pass
finally:
    raw=json.dumps(steps,ensure_ascii=True,allow_nan=False)
    cut=len(steps)>=2000
    while len(raw)>60000 and steps:
        cut=True;steps.pop();raw=json.dumps(steps,ensure_ascii=True,allow_nan=False)
    with open('/tmp/work/trace.json','w') as f:f.write(raw)
    if cut:
        with open('/tmp/work/trace-truncated','w') as f:f.write('1')
