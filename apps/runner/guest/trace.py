"""Runs inside a disposable VM as an unprivileged user. Never import on the host."""
import sys, json, runpy, collections
steps = []
def safe(v, depth=0):
    if depth > 3: return '[depth limit]'
    if type(v) in (int, float, bool, str, type(None)):
        return v[:200] if type(v) is str else (str(v)[:100] if type(v) is int and v.bit_length()>300 else v)
    if type(v) in (list, tuple, collections.deque): return [safe(x, depth+1) for x in list(v)[:30]]
    if type(v) is dict: return {str(k)[:40]:safe(x,depth+1) for k,x in list(v.items())[:30] if type(k) in (str,int)}
    return '['+type(v).__name__+']'
def trace(frame,event,arg):
    if frame.f_code.co_filename=='/tmp/work/main.py' and event in ('line','return','exception') and len(steps)<2000:
        stack=[]; parent=frame
        while parent and len(stack)<32:
            if parent.f_code.co_filename=='/tmp/work/main.py': stack.append(parent.f_code.co_name)
            parent=parent.f_back
        values={**frame.f_globals,**frame.f_locals}
        steps.append({'line':frame.f_lineno,'event':event,'locals':{k:safe(v) for k,v in list(values.items()) if not k.startswith('__') and type(v) in (int,float,bool,str,list,tuple,dict,collections.deque,type(None))},'stack':stack})
    return trace
try:
    sys.settrace(trace)
    runpy.run_path('/tmp/work/main.py',run_name='__main__')
finally:
    sys.settrace(None)
    try:
        encoded=json.dumps(steps,ensure_ascii=True,allow_nan=False)
        truncated=len(steps)>=2000 or len(encoded.encode())>60000
        while len(encoded.encode())>60000 and steps:
            steps.pop()
            encoded=json.dumps(steps,ensure_ascii=True,allow_nan=False)
        with open('/tmp/work/trace.json','w') as f:f.write(encoded)
        if truncated:
            with open('/tmp/work/trace-truncated','w') as f:f.write('1')
    except (OSError,ValueError):pass
