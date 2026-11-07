import { database } from "../apps/server/src/db.js";
import { seed } from "../apps/server/src/content.js";
import { createApp } from "../apps/server/src/app.js";
if (process.env.NODE_ENV !== "test")
  throw new Error("This isolated fixture requires NODE_ENV=test");
const db = await database();
await seed(db);
const app = await createApp({
  db,
  origin: "http://127.0.0.1:5173",
  googleClientId: "",
  sessionSecret: "e2e-only",
  runnerToken: "e2e-runner-secret",
  llmEnabled: false,
  testRateLimit: 10000,
  adminEmails: ["admin@example.test"],
  verifyGoogle: async (token) => {
    if (token === "integration-admin-token")
      return { sub: "e2e-admin", name: "관리자", email: "admin@example.test" };
    if (token !== "integration-test-token")
      throw new Error("Invalid fixture token");
    return {
      sub: "e2e-student",
      name: "학습자",
      email: "student@example.test",
    };
  },
});
await app.listen({ host: "127.0.0.1", port: 3001 });
