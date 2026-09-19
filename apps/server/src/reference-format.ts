// Curated C++/Java templates only. Preserve quoted bytes and for-header semicolons,
// put control bodies on their own lines so line debuggers expose each iteration.
export function formatReference(source:string) {
  let out='',quote='',escaped=false,depth=0;const parens:boolean[]=[];
  for(let i=0;i<source.length;i++) {
    const c=source[i];
    if(quote) {out+=c;if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote='';continue;}
    if(c==='"'||c==="'"){quote=c;out+=c;continue;}
    if(c==='('){parens.push(/\b(for|while|if|switch)\s*$/.test(out));out+=c;continue;}
    if(c===')'){out+=c;if(parens.pop())out+='\n';continue;}
    if(c==='{'){out+=' {\n';depth++;continue;}
    if(c==='}'){depth--;out+='\n}\n';continue;}
    out+=c;if(c===';'&&!parens.length)out+='\n';
  }
  let indent=0;
  return out.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{
    if(l.startsWith('}'))indent=Math.max(0,indent-1);
    const line='    '.repeat(indent)+l;
    if(l.endsWith('{'))indent++;return line;
  }).join('\n')+'\n';
}
