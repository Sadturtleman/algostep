import { test, expect } from "@playwright/test";
test("UI events survive a failed batch without duplicates or typed text; admin shows delivery status", async ({
  page,
}) => {
  const auth = await page.request.post("/api/auth/google", {
    headers: { origin: "http://127.0.0.1:5173" },
    data: { credential: "integration-admin-token" },
  });
  expect(auth.status()).toBe(200);
  const batches: any[][] = [];
  let failed = false;
  await page.route("**/api/analytics/events", async (route) => {
    batches.push(route.request().postDataJSON().events);
    if (!failed) {
      failed = true;
      await route.fulfill({
        status: 503,
        json: { message: "Temporary failure" },
      });
    } else await route.continue();
  });
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "학습 종류" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "학습 종류" })
    .getByRole("link")
    .first()
    .click();
  await page.getByRole("button", { name: "테마 변경" }).click();
  await expect.poll(() => batches.length).toBeGreaterThanOrEqual(2);
  expect(batches[1][0].requestKey).toBe(batches[0][0].requestKey);
  await page
    .locator("header nav")
    .getByRole("button", { name: "관리자", exact: true })
    .click();
  await page
    .getByRole("button", { name: "비즈니스 로그", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "GA4 · Redash 연결 상태" }),
  ).toBeVisible();
  await expect(
    page.getByText("GA4: 연결 설정 대기", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const r = await page.request.get("/api/admin/events?type=THEME_CHANGED");
      return r.json().then((d) => d.rows.length);
    })
    .toBeGreaterThan(0);
  const flattened = batches.flat();
  expect(flattened.some((e) => e.type === "SCREEN_VIEWED")).toBe(true);
  expect(flattened.some((e) => e.type === "CATEGORY_SELECTED")).toBe(true);
  expect(JSON.stringify(flattened)).not.toMatch(
    /example\.test|credential|source_code|access_token/,
  );
  await page.screenshot({
    path: "test-results/analytics-status.png",
    fullPage: true,
  });
});
