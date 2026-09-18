import { test, expect } from "@playwright/test";
async function authenticate(page: any) {
  await page.request.post("/api/auth/google", {
    headers: { origin: "http://127.0.0.1:5173" },
    data: { credential: "integration-test-token" },
  });
}
test("login gate, theme and setup state", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByText("Google 로그인이 아직 연결되지 않았어요."),
  ).toBeVisible();
  await page.getByRole("button", { name: "테마 변경" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/login-dark.png",
    fullPage: true,
  });
});
test("learning, quizzes and graph/tree explanatory diagrams", async ({
  page,
}) => {
  await authenticate(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "개념별 학습" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /너비 우선 탐색/ }).click();
  await expect(
    page.getByRole("img", { name: "그래프의 현재 방문 상태" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "다음 단계" }).click();
  await page.getByRole("button", { name: "2 큐에 넣을 때" }).click();
  await page.getByRole("button", { name: "정답 확인" }).click();
  await expect(page.getByText("정답이에요!")).toBeVisible();
  await page.screenshot({
    path: "test-results/graph-lesson.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "학습 목록" }).click();
  await page.getByRole("button", { name: /이진 트리 순회/ }).click();
  await expect(
    page.getByRole("img", { name: "이진 트리와 현재 노드" }),
  ).toBeVisible();
});
test("workspace autosaves and queues a real request without fabricated execution", async ({
  page,
}) => {
  await authenticate(page);
  await page.goto("/");
  await page.getByRole("button", { name: "문제 풀기", exact: true }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "정렬된 배열에서 값 찾기" })
    .getByRole("button", { name: "문제 풀기" })
    .click();
  await expect(page.getByText("main.py", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "권장 코드 불러오기" }).click();
  await expect(page.getByRole("status")).toHaveText("저장됨");
  await page.getByRole("button", { name: "전체 테스트 실행" }).click();
  await expect(
    page.getByText("실행 환경을 기다리고 있어요.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "코드 리뷰", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "현재 코드 리뷰 요청" }),
  ).toBeDisabled();
  await page.screenshot({ path: "test-results/workspace.png", fullPage: true });
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  await download.saveAs("test-results/record.pdf");
  expect(await download.failure()).toBeNull();
  await page.getByRole("button", { name: "내 기록", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "정렬된 배열에서 값 찾기" }),
  ).toBeVisible();
});
test("mobile offers lessons and quizzes, not coding navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "개념별 학습" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "문제 풀기", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "내 기록", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
test("network outage uses full-screen recovery CTA", async ({ page }) => {
  await authenticate(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "개념별 학습" }),
  ).toBeVisible();
  await page.route("**/api/records", (route) => route.abort());
  await page.getByRole("button", { name: "내 기록", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "연결이 잠시 끊겼어요" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "작성 화면으로 돌아가기" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/network-error.png",
    fullPage: true,
  });
});
