import { test, expect } from "@playwright/test";

test("MVP loads without excluded API calls and retains learning and editor routes", async ({
  page,
}) => {
  test.skip(
    process.env.E2E_PRODUCT_MODE !== "mvp",
    "Run with E2E_PRODUCT_MODE=mvp",
  );
  const login = await page.request.post("/api/auth/google", {
    headers: { origin: "http://127.0.0.1:5173" },
    data: { credential: "integration-test-token" },
  });
  expect(login.ok()).toBeTruthy();
  const excluded: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/(analytics|review-usage|admin|support)/.test(r.url()))
      excluded.push(r.url());
  });
  await page.goto("/learn");
  await expect(
    page.getByRole("button", { name: "문제 풀기", exact: true }),
  ).toBeVisible();
  for (const name of ["관리자", "문의하기", "구독 안내"])
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
      0,
    );
  expect(
    (await (await page.request.get("/api/topics")).json()).topics,
  ).toHaveLength(8);
  await page.goto("/learn/binary-search/concept");
  await expect(
    page.getByRole("tab", { name: "단계별 예제", exact: true }),
  ).toBeVisible();
  await page.goto("/learn/binary-search/predict/1");
  await expect(page.getByText("존재하지 않는 학습 단계예요")).toHaveCount(0);
  await page.goto("/learn/binary-search/code");
  await expect(
    page.getByRole("button", { name: "전체 테스트 실행", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "PDF", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "코드 리뷰", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "전체 테스트 실행", exact: true }),
  ).toBeVisible();
  expect(excluded).toEqual([]);
  await page.screenshot({
    path: "test-results/mvp-editor.png",
    fullPage: true,
  });
});
