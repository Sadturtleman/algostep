import type { FastifyInstance } from "fastify";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { openapi } from "./openapi.js";

const require = createRequire(import.meta.url);
export async function registerApiDocs(app: FastifyInstance) {
  app.get("/openapi.json", async () => openapi);
  for (const [file, type] of [
    ["swagger-ui.css", "text/css"],
    ["swagger-ui-bundle.js", "application/javascript"],
  ]) {
    const asset = await readFile(require.resolve(`swagger-ui-dist/${file}`));
    app.get(`/docs/assets/${file}`, async (_req, reply) =>
      reply.type(type).send(asset),
    );
  }
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Algostep MVP API · Swagger</title><link rel="stylesheet" href="/docs/assets/swagger-ui.css"></head><body>
<div style="padding:16px;font-family:sans-serif"><a href="/">서비스에서 Google 로그인</a> · <a href="/openapi.json" download="algostep-openapi.json">OpenAPI 다운로드</a><p>Try it out은 현재 서버의 실제 데이터를 사용합니다. 변경 요청은 로그인 후 실행하세요.</p></div><div id="swagger-ui"></div>
<script src="/docs/assets/swagger-ui-bundle.js"></script><script>
SwaggerUIBundle({url:'/openapi.json',dom_id:'#swagger-ui',deepLinking:true,validatorUrl:null,persistAuthorization:false,withCredentials:true,
requestInterceptor:async function(req){
  const url=new URL(req.url,location.href);req.credentials='include';
  if(url.origin===location.origin && url.pathname.startsWith('/api/') && !['GET','HEAD','OPTIONS'].includes(req.method.toUpperCase()) && url.pathname!='/api/auth/google'){
    const res=await fetch('/api/me',{credentials:'include'});
    if(!res.ok)throw new Error('서비스에서 Google 로그인 후 다시 시도하세요.');
    req.headers['x-csrf-token']=(await res.json()).csrf;
  }
  return req;
}});
</script></body></html>`;
  app.get("/docs", async (_req, reply) =>
    reply.type("text/html; charset=utf-8").send(html),
  );
  app.get("/docs/", async (_req, reply) =>
    reply.type("text/html; charset=utf-8").send(html),
  );
}
