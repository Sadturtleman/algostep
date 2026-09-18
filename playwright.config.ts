import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npx tsx tests/e2e-server.ts",
      url: "http://127.0.0.1:3001/api/health",
      env: { NODE_ENV: "test" },
      timeout: 60000,
    },
    {
      command: "npm run dev -w apps/web",
      url: "http://127.0.0.1:5173",
      timeout: 60000,
    },
  ],
});
