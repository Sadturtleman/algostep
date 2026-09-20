"""Render deterministic algorithm traces exported by export-learning-frames.ts.
Requires Pillow. No user code or external image input is involved.
"""
import json, math, os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parents[1]
data=json.loads((root/'tmp/learning-v2/frames.json').read_text(encoding='utf-8'))
out=root/'apps/web/public/learning';out.mkdir(parents=True,exist_ok=True)
font_path=os.environ.get('ALGOSTEP_FONT', 'C:/Windows/Fonts/malgun.ttf')
font=ImageFont.truetype(font_path,20)
small=ImageFont.truetype(font_path,16)
def fitted(d, text, width, size=20):
 for px in range(size,7,-1):
  f=ImageFont.truetype(font_path,px)
  if d.textbbox((0,0),text,font=f)[2] <= width: return f
 raise ValueError(f'Label too wide: {text}')
def lines(d,text,width,f):
 result=[];line=''
 for ch in str(text):
  if d.textlength(line+ch,font=f)>width and line:result.append(line);line=ch
  else:line+=ch
 if line:result.append(line)
 return result

def wrap(s,n=48):
 return '\n'.join(str(s)[i:i+n] for i in range(0,len(str(s)),n))
for item in data:
 for mode in ['light','dark']:
  bg,fg,line,accent,tint,on=('#ffffff','#18213a','#dce1ec','#3159dd','#eaf0ff','#ffffff') if mode=='light' else ('#192133','#edf1fa','#35435d','#9bb4ff','#22365f','#101522')
  images=[]
  previous_nodes={};previous_rows=[];previous_values=[]
  # Keep every state: playback and manual examples come from the same computation.
  for index,frame in enumerate(item['frames']):
   im=Image.new('RGB',(960,600),bg);d=ImageDraw.Draw(im)
   d.text((28,18),f'{index+1} / {len(item["frames"])}',font=small,fill=accent)
   note_lines=lines(d,frame['note'],890,font)
   if len(note_lines)>3: raise ValueError('Note overflows: '+frame['note'])
   d.multiline_text((28,46),'\n'.join(note_lines),font=font,fill=fg,spacing=5)
   nodes=[];edges=[];rows=[]
   if frame.get('advanced'):
    a=frame['advanced'];nodes=a['nodes'];edges=a['edges'];rows=a['rows']
   else:
    v=frame['core']['vars'];a=v.get('values',v.get('a',[]))
    if 'graph' in v:
     n=len(v['graph'])
     nodes=[dict(id=str(i),label=str(i),x=400+240*math.cos(i*2*math.pi/n-math.pi/2),y=230+180*math.sin(i*2*math.pi/n-math.pi/2),shape='circle',state='active' if i==v.get('current') else '') for i in range(n)]
     edges=[dict(**{'from':str(i),'to':str(j)}) for i,row in enumerate(v['graph']) for j in row if i<j]
    elif item['topic']=='tree':
     for i,value in enumerate(a):
      depth=int(math.log2(i+1));pos=i-(2**depth-1)
      nodes.append(dict(id=str(i),label=str(value),x=(pos+.5)*800/(2**depth),y=depth*95,shape='circle',state='active' if i==v.get('index') else ''))
      if i:edges.append({'from':str((i-1)//2),'to':str(i)})
    elif v.get('root') or v.get('head'):
     def visit(n,x,y,gap):
      if not isinstance(n,dict):return
      f=n.get('fields',{});nid=n.get('$id',str(len(nodes)));nodes.append(dict(id=nid,label=str(f.get('value','')),x=x,y=y,shape='circle'))
      children=[(k,f[k]) for k in ['left','right','next'] if isinstance(f.get(k),dict)]
      for k,c in children:
       edges.append({'from':nid,'to':c.get('$id','')});visit(c,x+(-gap if k=='left' else gap),y+85,gap/2)
     visit(v.get('root') or v.get('head'),400,0,210)
    else:
     nodes=[dict(id=str(i),label=str(x),detail=f'[{i}]',x=60+(i%8)*100,y=80+(i//8)*100,shape='card',state='active' if i in [v.get(k) for k in ['mid','index','i','j','current']] or (i<len(previous_values) and previous_values[i]!=x) or ('추가' in frame['note'] and i==len(a)-1) else '') for i,x in enumerate(a)]
    previous_values=list(a) if isinstance(a,list) else []
    rows=[[k,json.dumps(value,ensure_ascii=False)] for k,value in v.items() if k not in ['a','values','graph','root','head']]
   if nodes:
    xs=[n['x'] for n in nodes];ys=[n['y'] for n in nodes];sx=800/max(800,max(xs)-min(xs));sy=240/max(240,max(ys)-min(ys))
    pos={n['id']:(80+(n['x']-min(xs))*sx,160+(n['y']-min(ys))*sy) for n in nodes}
    for e in edges:
     if e['from'] in pos and e['to'] in pos:
      p1,p2=pos[e['from']],pos[e['to']];d.line([p1,p2],fill=line,width=3)
      if e.get('label'):d.text(((p1[0]+p2[0])/2,(p1[1]+p2[1])/2-12),str(e['label']),font=small,fill=fg)
    for n in nodes:
     x,y=pos[n['id']]
     changed=n['id'] in previous_nodes and previous_nodes[n['id']] != (n['label'],n.get('detail'))
     active=n.get('state')=='active' or changed
     fill=accent if active else ('#d3f3df' if mode=='light' else '#234c3b') if n.get('state')=='visited' else tint
     card=n.get('shape')=='card'; w,h=(82,68) if card else (60,60)
     box=(x-w/2,y-h/2,x+w/2,y+h/2)
     if card:d.rounded_rectangle(box,radius=9,fill=fill,outline=accent if active else line,width=3 if active else 2)
     else:d.ellipse(box,fill=fill,outline=accent if active else line,width=3 if active else 2)
     label=str(n['label']); detail=str(n.get('detail',''))
     lf=fitted(d,label,w-18)
     d.text((x,y-9 if card and detail else y),label,font=lf,fill=on if active else fg,anchor='mm')
     if detail:
      df=fitted(d,detail,78 if card else 90,16)
      d.text((x,y+18 if card else y+42),detail,font=df,fill=on if active and card else fg,anchor='mm')
   previous_nodes={n['id']:(n['label'],n.get('detail')) for n in nodes}
   for j,row in enumerate(rows[:5]):
    text='  |  '.join(map(str,row));rf=fitted(d,text,880,16)
    changed=j>=len(previous_rows) or row!=previous_rows[j]
    if changed:d.rounded_rectangle((22,458+j*25,938,482+j*25),radius=4,fill=tint)
    d.text((28,460+j*25),text,font=rf,fill=accent if changed else fg)
   previous_rows=rows
   images.append(im)
  name=f'{item["topic"]}-{mode}'
  images[0].save(out/(name+'.png'))
  images[0].save(out/(name+'.gif'),save_all=True,append_images=images[1:],duration=1500,loop=0,optimize=True)
print(f'Rendered {len(data)} topics in both themes')
