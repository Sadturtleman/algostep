import type { FastifyInstance } from "fastify";
import staticFiles from "@fastify/static";
export async function registerWeb(app: FastifyInstance, root: string) {
  await app.register(staticFiles, { root, prefix: "/" });
  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split("?")[0];
    if (
      (request.method === "GET" || request.method === "HEAD") &&
      path !== "/api" &&
      !path.startsWith("/api/") &&
      !path.split("/").at(-1)?.includes(".") &&
      request.headers.accept?.includes("text/html")
    )
      return reply.type("text/html").sendFile("index.html");
    return reply
      .code(404)
      .send({ code: "NOT_FOUND", message: "페이지를 찾을 수 없어요." });
  });
}
