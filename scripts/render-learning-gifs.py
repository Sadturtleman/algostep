"""Render deterministic algorithm traces exported by export-learning-frames.ts.
Requires Pillow. No user code or external image input is involved.
"""
import json, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parents[1]
data=json.loads((root/'tmp/learning-v2/frames.json').read_text(encoding='utf-8'))
out=root/'apps/web/public/learning';out.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',20)
small=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',16)
def wrap(s,n=48):
 return '\n'.join(str(s)[i:i+n] for i in range(0,len(str(s)),n))
for item in data:
 for mode in ['light','dark']:
  bg,fg,line,accent,tint,on=('#ffffff','#18213a','#dce1ec','#3159dd','#eaf0ff','#ffffff') if mode=='light' else ('#192133','#edf1fa','#35435d','#9bb4ff','#22365f','#101522')
  images=[]
  # Keep every state: playback and manual examples come from the same computation.
  for index,frame in enumerate(item['frames']):
   im=Image.new('RGB',(960,600),bg);d=ImageDraw.Draw(im)
   d.text((28,18),f'{index+1} / {len(item["frames"])}',font=small,fill=accent)
   d.multiline_text((28,46),wrap(frame['note']),font=font,fill=fg,spacing=5)
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
     nodes=[dict(id=str(i),label=str(x),detail=f'[{i}]',x=60+(i%8)*100,y=80+(i//8)*100,shape='card',state='active' if i==v.get('mid') else '') for i,x in enumerate(a)]
    rows=[[k,json.dumps(value,ensure_ascii=False)] for k,value in v.items() if k not in ['a','values','graph','root','head']]
   if nodes:
    xs=[n['x'] for n in nodes];ys=[n['y'] for n in nodes];sx=820/max(820,max(xs)-min(xs)+100);sy=280/max(280,max(ys)-min(ys)+90)
    pos={n['id']:(70+(n['x']-min(xs))*sx,145+(n['y']-min(ys))*sy) for n in nodes}
    for e in edges:
     if e['from'] in pos and e['to'] in pos:
      p1,p2=pos[e['from']],pos[e['to']];d.line([p1,p2],fill=line,width=3)
      if e.get('label'):d.text(((p1[0]+p2[0])/2,(p1[1]+p2[1])/2-12),str(e['label']),font=small,fill=fg)
    for n in nodes:
     x,y=pos[n['id']];active=n.get('state') in ['active','visited'];fill=accent if active else tint
     box=(x-32,y-25,x+32,y+25)
     if n.get('shape')=='circle':d.ellipse(box,fill=fill,outline=line,width=2)
     else:d.rounded_rectangle(box,radius=9,fill=fill,outline=line,width=2)
     d.text((x,y),str(n['label'])[:8],font=font,fill=on if active else fg,anchor='mm')
     if n.get('detail'):d.text((x,y+31),str(n['detail'])[:12],font=small,fill=fg,anchor='mm')
   for j,row in enumerate(rows[:6]):d.text((28,440+j*24),'  |  '.join(map(str,row))[:85],font=small,fill=fg)
   images.append(im)
  name=f'{item["topic"]}-{mode}'
  images[0].save(out/(name+'.png'))
  images[0].save(out/(name+'.gif'),save_all=True,append_images=images[1:],duration=1500,loop=0,optimize=True)
print(f'Rendered {len(data)} topics in both themes')
