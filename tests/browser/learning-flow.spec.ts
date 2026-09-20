import { test, expect } from "@playwright/test";
import {
  checkpoints,
  answerText,
} from "../../apps/web/src/prediction-model.js";
async function login(page: any) {
  await page.request.post("/api/auth/google", {
    headers: { origin: "http://127.0.0.1:5173" },
    data: { credential: "integration-test-token" },
  });
}
test("concept, prediction and editor have separate URLs; back, forward and refresh restore answers and code", async ({
  page,
}) => {
  await login(page);
  await page.goto("/learn/binary-search/concept");
  await expect(
    page.getByRole("heading", { name: "기본 개념", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".example-animation img")).toHaveJSProperty(
    "naturalWidth",
    960,
  );
  await expect(
    page.getByRole("heading", { name: "내가 만드는 다음 상태" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "다음 상태 예측하기", exact: true })
    .click();
  await expect(page).toHaveURL(/\/learn\/binary-search\/predict\/1$/);
  await expect(
    page.getByRole("button", { name: "정답 확인", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "2 · 인덱스 0", exact: true }).click();
  await page.getByRole("button", { name: "정답 확인", exact: true }).click();
  await expect(
    page.getByText("다시 생각해 보세요.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "다음 단계", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "34 · 인덱스 5", exact: true })
    .click();
  await page.getByRole("button", { name: "정답 확인", exact: true }).click();
  await expect(page.getByText("정답이에요!", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "다음 단계", exact: true }).click();
  await expect(page).toHaveURL(/predict\/2$/);
  await page.goBack();
  await expect(page).toHaveURL(/predict\/1$/);
  await expect(page.getByText("정답이에요!", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("정답이에요!", { exact: true })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/predict\/2$/);
  await page.getByRole("link", { name: "03 코드 작성" }).click();
  await expect(page.getByText("main.py", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/learn\/binary-search\/code\?record=/);
  const url = page.url();
  const before = (await (await page.request.get("/api/records")).json()).records
    .length;
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "권장 코드 불러오기" }).click();
  await page.goBack();
  await expect(page).toHaveURL(/predict\/2$/);
  await page.goForward();
  await expect(page.getByText("main.py", { exact: true })).toBeVisible();
  const saved = await (
    await page.request.get(
      `/api/records/${new URL(page.url()).searchParams.get("record")}`,
    )
  ).json();
  expect(saved.source).toContain("while left <= right");
  await page.reload();
  await expect(page.getByText("main.py", { exact: true })).toBeVisible();
  expect(page.url()).toBe(url);
  expect(
    (await (await page.request.get("/api/records")).json()).records.length,
  ).toBe(before);
  await page.getByRole("link", { name: "01 개념 이해" }).click();
  await page.goBack();
  await expect(page.getByText("main.py", { exact: true })).toBeVisible();
});
test("graph and tree nodes accept mouse and keyboard answers; advanced state fields can be checked", async ({
  page,
}) => {
  await login(page);
  for (const topic of [
    "bfs",
    "tree",
    "lca",
    "geometry",
    "fft",
    "segment-tree",
  ]) {
    const q = checkpoints(topic)[0];
    await page.goto(`/learn/${topic}/predict/1`);
    if (["bfs", "tree"].includes(topic)) {
      const node = page.locator(
        `[aria-label="다음 상태 선택"] .diagram-node[data-node-id="${q.answer}"]`,
      );
      await node.focus();
      await node.press("Enter");
    } else
      await page
        .getByRole("textbox", { name: "다음 상태의 값" })
        .fill(answerText(q.answer));
    await page.getByRole("button", { name: "정답 확인", exact: true }).click();
    await expect(page.getByText("정답이에요!", { exact: true })).toBeVisible();
    for (const width of [1440, 412]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.screenshot({
      path: `test-results/prediction-${topic}.png`,
      fullPage: true,
    });
  }
});
test("all prediction steps are solvable without leaking next-state explanations; mobile never creates a code record", async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 412, height: 900 });
  const questions = checkpoints("binary-search");
  await page.goto("/learn/binary-search/predict/1");
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    await page
      .getByRole("button", {
        name: q.choices!.find((c) => c.value === q.answer)!.label,
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "정답 확인", exact: true }).click();
    await expect(page.getByText("정답이에요!", { exact: true })).toBeVisible();
    if (i < questions.length - 1)
      await page
        .getByRole("button", { name: "다음 단계", exact: true })
        .click();
  }
  await expect(
    page.getByRole("button", { name: "학습 완료 · 목록으로" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "03 코드 작성" })).toHaveCount(0);
  const before = (await (await page.request.get("/api/records")).json()).records
    .length;
  await page.goto("/learn/binary-search/code");
  await expect(
    page.getByRole("heading", { name: "코드 작성은 PC 웹에서 이용해 주세요" }),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/records")).json()).records.length,
  ).toBe(before);
});
test("unknown paths and invalid topics have recovery; authentication preserves deep links", async ({
  page,
}) => {
  await page.goto("/learn/bfs/predict/2");
  await expect(
    page.getByText("Google 로그인이 아직 연결되지 않았어요."),
  ).toBeVisible();
  await login(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /현재 상태 · 2/ }),
  ).toBeVisible();
  for (const path of [
    "/missing",
    "/learn/missing/concept",
    "/learn/bfs/predict/0",
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "페이지를 찾을 수 없어요" }),
    ).toBeVisible();
  }
  await page.goto("/learn/bfs/predict/999");
  await expect(
    page.getByRole("heading", { name: "존재하지 않는 학습 단계예요" }),
  ).toBeVisible();
});
