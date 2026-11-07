import { test, expect } from "@playwright/test";

test("wide learning panel switches exclusive vertical tabs and shows worked case and complexity table", async ({
  page,
}) => {
  await page.request.post("/api/auth/google", {
    headers: { origin: "http://127.0.0.1:5173" },
    data: { credential: "integration-test-token" },
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/learn/binary-search-lower-bound/concept");
  await expect(
    page.getByRole("heading", { name: "lower bound 경계 탐색", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "사용 용도" })).toContainText(
    "[2,5,5,9]",
  );
  await expect(page.locator(".complexity-table")).toContainText("시간");
  expect((await page.locator("main").boundingBox())!.width).toBeGreaterThan(
    1600,
  );
  await expect(page.locator(".example-animation img")).toHaveJSProperty(
    "naturalWidth",
    960,
  );
  await expect(page.getByLabel("예제 선택", { exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "단계별 예제", exact: true }).click();
  await expect(page.locator(".example-animation img")).toHaveCount(0);
  await expect(page.getByLabel("예제 선택", { exact: true })).toBeVisible();
  await expect(page.locator(".array-board .node-detail").first()).toContainText(
    "[0]",
  );
  await page.screenshot({
    path: "test-results/wide-learning-tabs.png",
    fullPage: true,
  });
  await page
    .getByRole("tab", { name: "단계별 예제", exact: true })
    .press("ArrowUp");
  await expect(page.getByRole("tab", { name: "자동 동작" })).toBeFocused();
  await expect(page.locator(".example-animation img")).toBeVisible();
  await page.getByRole("link", { name: "03 코드 작성" }).click();
  await expect(page.getByText("main.py", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/binary-search-lower-bound\/code\?record=/);
  await page.reload();
  await expect(page.getByText("main.py", { exact: true })).toBeVisible();
});

test("subscription and checkout previews have paths, no active payment, and responsive layouts", async ({
  page,
}) => {
  await page.request.post("/api/auth/google", {
    headers: { origin: "http://127.0.0.1:5173" },
    data: { credential: "integration-test-token" },
  });
  const mutations: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && /payment|checkout|subscription/.test(r.url()))
      mutations.push(r.url());
  });
  await page.goto("/plans");
  await expect(
    page.getByText("LLM 코드 리뷰 월 3건", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "결제 화면 미리 보기" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(
    page.getByRole("button", { name: "결제 준비 중" }),
  ).toBeDisabled();
  await expect(page.locator(".billing-page input")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "구독 결제 안내" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/checkout-preview.png",
    fullPage: true,
  });
  await page.goBack();
  await expect(page).toHaveURL(/\/plans$/);
  for (const width of [1920, 1024, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "테마 변경" }).click();
  await page.screenshot({
    path: "test-results/plans-mobile.png",
    fullPage: true,
  });
  expect(mutations).toEqual([]);
});
