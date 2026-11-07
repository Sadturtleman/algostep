import { test, expect } from "@playwright/test";
const origin = "http://127.0.0.1:5173";
async function login(page: any, credential: string) {
  const r = await page.request.post("/api/auth/google", {
    headers: { origin },
    data: { credential },
  });
  expect(r.status()).toBe(200);
  await page.goto("/");
}
test("student inquiry reaches administrator, reply returns to owner, and admin metrics render", async ({
  page,
  browser,
}) => {
  await login(page, "integration-test-token");
  await expect(
    page.getByRole("button", { name: "관리자", exact: true }),
  ).toHaveCount(0);
  expect((await page.request.get("/api/admin/dashboard")).status()).toBe(403);
  await page.getByRole("button", { name: "문의하기", exact: true }).click();
  await page.getByLabel("제목", { exact: true }).fill("시각화 표시 문의");
  await page
    .getByLabel("문의 내용", { exact: true })
    .fill("그래프 노드가 겹쳐요. 확인 부탁드려요.");
  await page.getByRole("button", { name: "문의 접수", exact: true }).click();
  await expect(
    page.getByText("문의가 접수됐어요. 아래 목록에서 답변을 확인해 주세요."),
  ).toBeVisible();
  const context = await browser.newContext({
    baseURL: origin,
    viewport: { width: 1440, height: 1000 },
  });
  const manager = await context.newPage();
  try {
    await login(manager, "integration-admin-token");
    await manager
      .locator("header nav")
      .getByRole("button", { name: "관리자", exact: true })
      .click();
    await expect(
      manager.getByRole("heading", { name: "운영 대시보드", exact: true }),
    ).toBeVisible();
    await expect(
      manager.getByText("누적 접속자", { exact: true }),
    ).toBeVisible();
    await expect(
      manager.getByText("이번 주 접속자", { exact: true }),
    ).toBeVisible();
    await expect(
      manager.getByText("이번 달 접속자", { exact: true }),
    ).toBeVisible();
    await expect(
      manager.getByRole("img", { name: /기간별 고유 접속자/ }),
    ).toBeVisible();
    await manager.screenshot({
      path: "test-results/admin-overview.png",
      fullPage: true,
    });
    await manager.getByRole("button", { name: "문의", exact: true }).click();
    const ticket = manager
      .getByRole("article")
      .filter({
        has: manager.getByRole("heading", {
          name: "시각화 표시 문의",
          exact: true,
        }),
      })
      .first();
    await ticket
      .getByLabel("사용자에게 보여줄 답변")
      .fill("노드 위치를 드래그해 조정할 수 있어요.");
    await ticket.getByLabel("문의 처리 상태").selectOption("RESOLVED");
    await ticket.getByRole("button", { name: "답변 및 상태 저장" }).click();
    await expect(
      manager.getByText("문의 상태와 답변을 저장했어요."),
    ).toBeVisible();
    await page.getByRole("button", { name: "목록 새로고침" }).click();
    await expect(
      page.getByText("노드 위치를 드래그해 조정할 수 있어요."),
    ).toBeVisible();
    await manager
      .getByRole("button", { name: "비용·매출", exact: true })
      .click();
    await expect(
      manager.getByText("비용 자료 미수집", { exact: true }),
    ).toBeVisible();
    const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    await manager.getByLabel("비용 JSON 파일").setInputFiles({
      name: "actuals.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          entries: [
            {
              sourceKey: "browser-test-cost",
              usageDate: day,
              service: "Compute Engine",
              currency: "KRW",
              amount: 1250,
              source: "e2e fixture (not live billing)",
            },
          ],
        }),
      ),
    });
    await manager
      .getByRole("button", { name: "비용 자료 적용", exact: true })
      .click();
    await expect(
      manager.getByRole("heading", { name: "비용 원장", exact: true }),
    ).toBeVisible();
    await expect(manager.getByText("1,250 KRW").first()).toBeVisible();
    await manager
      .getByRole("button", { name: "비즈니스 로그", exact: true })
      .click();
    await expect(
      manager.getByRole("heading", { name: "비즈니스 이벤트 기록" }),
    ).toBeVisible();
    await manager.getByLabel("이벤트 종류").selectOption("INQUIRY_CREATED");
    await expect(
      manager
        .locator(".dashboard-table tbody")
        .getByText("문의 접수", { exact: true }),
    ).toBeVisible();
    await manager
      .getByRole("button", { name: "전체 현황", exact: true })
      .click();
    await manager.getByRole("button", { name: "테마 변경" }).click();
    await expect(manager.locator("html")).toHaveAttribute("data-theme", "dark");
    await manager.screenshot({
      path: "test-results/admin-dark.png",
      fullPage: true,
    });
    await manager.setViewportSize({ width: 390, height: 844 });
    await expect(
      manager.getByRole("heading", { name: "운영 대시보드", exact: true }),
    ).toBeVisible();
    expect(
      await manager.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await manager.screenshot({
      path: "test-results/admin-mobile.png",
      fullPage: true,
    });
  } finally {
    await context.close();
  }
});
