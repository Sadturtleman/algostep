import { test, expect } from "@playwright/test";
test("all P1 and P2 topics expose working scenarios and advanced diagram controls", async ({
  page,
}) => {
  await authenticate(page);
  await page.goto("/");
  const names = [
    "유니온 파인드",
    "트라이",
    "세그먼트 트리",
    "펜윅 트리",
    "다익스트라",
    "벨만–포드",
    "플로이드–워셜",
    "최소 신장 트리",
    "위상 정렬",
    "KMP 문자열 검색",
    "균형 탐색 트리",
    "강한 연결 요소",
    "최소 공통 조상",
    "고급 DP 최적화",
    "기하 알고리즘",
    "FFT와 다항식 곱셈",
    "최대 유량",
  ];
  for (const name of names) {
    await page
      .getByRole("button")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .click();
    for (const v of ["0", "1", "2"]) {
      await page.getByLabel("예제 선택", { exact: true }).selectOption(v);
      await expect(
        page.getByRole("img", { name: "학습 알고리즘 상태" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "다음 단계", exact: true })
        .click();
      const last = page.getByRole("button", { name: "마지막", exact: true });
      if (await last.isEnabled()) await last.click();
      await expect(
        page.getByRole("button", { name: "다음 단계", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("table", { name: "단계별 계산 상태" }),
      ).toBeVisible();
    }
    if (name === "최대 유량") {
      await page.getByLabel("예제 선택", { exact: true }).selectOption("0");
      await page.getByRole("button", { name: "마지막", exact: true }).click();
      await page.screenshot({
        path: "test-results/advanced-flow.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: "테마 변경" }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: "test-results/advanced-mobile.png",
        fullPage: true,
      });
    }
    await page.getByRole("button", { name: "학습 목록", exact: true }).click();
  }
});
async function authenticate(page: any) {
  await page.request.post("/api/auth/google", {
    headers: { origin: "http://127.0.0.1:5173" },
    data: { credential: "integration-test-token" },
  });
}

test("expanded quizzes and movable diagrams retain positions across steps", async ({
  page,
}) => {
  await authenticate(page);
  await page.goto("/");
  await page.getByRole("button", { name: /너비 우선 탐색/ }).click();
  await expect(page.getByText(/문항 1 \/ 3/)).toHaveCount(0);
  await page
    .getByRole("button", { name: "이해했어요. 퀴즈 풀기", exact: true })
    .click();
  await expect(page.getByText(/문항 1 \/ 3/)).toBeVisible();
  await page.getByRole("button", { name: "다음 문항", exact: true }).click();
  await expect(page.getByText(/0의 이웃이/)).toBeVisible();
  await page.getByRole("button", { name: "1 [0,1,2,3]", exact: true }).click();
  await page.getByRole("button", { name: "정답 확인", exact: true }).click();
  await expect(page.getByText("정답이에요!", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "개념과 예제로 돌아가기", exact: true })
    .click();
  await page.getByLabel("예제 선택", { exact: true }).selectOption("1");
  const node = page.locator('.diagram-node[data-node-id="0"]').first();
  await node.scrollIntoViewIfNeeded();
  const original = await node.getAttribute("transform");
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width / 2 + 60,
    box!.y + box!.height / 2 + 30,
    { steps: 5 },
  );
  await page.mouse.up();
  const moved = await node.getAttribute("transform");
  expect(moved).not.toBe(original);
  await page.getByRole("button", { name: "다음 단계", exact: true }).click();
  await expect(node).toHaveAttribute("transform", moved!);
  await node.focus();
  await node.press("ArrowRight");
  expect(await node.getAttribute("transform")).not.toBe(moved);
  await page.getByRole("button", { name: "배치 초기화", exact: true }).click();
  await expect(node).toHaveAttribute("transform", original!);
  await page.getByLabel("예제 선택", { exact: true }).selectOption("2");
  await expect(page.getByText(/0에서 도달할 수 없는/)).toBeVisible();
  await page.screenshot({
    path: "test-results/expanded-graph.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "테마 변경" }).click();
  await page.screenshot({
    path: "test-results/expanded-graph-mobile-dark.png",
    fullPage: true,
  });
});
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
  await page
    .getByRole("button", { name: "이해했어요. 퀴즈 풀기", exact: true })
    .click();
  await page.getByRole("button", { name: "2 큐에 넣을 때" }).click();
  await page.getByRole("button", { name: "정답 확인" }).click();
  await expect(page.getByText("정답이에요!")).toBeVisible();
  await page.screenshot({
    path: "test-results/graph-lesson.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "개념과 예제로 돌아가기", exact: true })
    .click();
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
  const before = (await (await page.request.get("/api/records")).json()).records
    .length;
  await page
    .getByRole("article")
    .filter({ hasText: "정렬된 배열에서 값 찾기" })
    .getByRole("button", { name: "개념과 예제 보기" })
    .click();
  await expect(
    page.getByRole("heading", { name: "기본 개념", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "개념을 한 단계씩", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("main.py", { exact: true })).toHaveCount(0);
  expect(
    (await (await page.request.get("/api/records")).json()).records.length,
  ).toBe(before);
  const concept = await page.locator(".lesson-layout .prose").boundingBox(),
    example = await page.locator(".lesson-example-column").boundingBox();
  expect(concept!.x + concept!.width).toBeLessThan(example!.x);
  expect(Math.abs(concept!.y - example!.y)).toBeLessThan(2);
  await page.screenshot({
    path: "test-results/learning-before-coding.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "이해했어요. 퀴즈 풀기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "기본 개념", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("예제 선택", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "이진 탐색 이해 확인", exact: true }),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/records")).json()).records.length,
  ).toBe(before);
  await page.screenshot({
    path: "test-results/separate-practice-screen.png",
    fullPage: true,
  });
  await expect(
    page.getByRole("heading", { name: "잠깐, 이해했나요?", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "이해했다면, 직접 풀어볼까요?",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "코드로 풀기", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "직접 풀어보기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "잠깐, 이해했나요?", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "이해했다면, 직접 풀어볼까요?",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/separate-coding-screen.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "이해 확인으로 돌아가기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "잠깐, 이해했나요?", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "직접 풀어보기", exact: true })
    .click();
  await page.getByRole("button", { name: "코드로 풀기", exact: true }).click();
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

test("home groups all topics by type without priority labels and supports search", async ({
  page,
}) => {
  await authenticate(page);
  await page.goto("/");
  await expect(page.locator(".topic-card")).toHaveCount(47);
  await expect(
    page.getByRole("navigation", { name: "학습 종류" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "트리 학습" })
      .getByRole("heading", { name: "이진 탐색 트리", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "정렬 학습" }).locator(".topic-card"),
  ).toHaveCount(6);
  expect(await page.locator("main").innerText()).not.toMatch(/\bP[012]\b/);
  await page.screenshot({
    path: "test-results/grouped-home.png",
    fullPage: true,
  });
  await page.getByLabel("개념 검색").fill("동적 계획법");
  await expect(page.locator(".topic-section")).toHaveCount(1);
  await expect(page.locator(".topic-card")).toHaveCount(4);
  await page.getByLabel("개념 검색").fill("없는개념xyz");
  await expect(page.getByRole("status")).toContainText("검색 결과가 없어요");
  await page.getByLabel("개념 검색").fill("FFT");
  await page.locator(".topic-card").click();
  await expect(
    page.getByRole("button", { name: "다른 문제 살펴보기" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "이해했어요. 퀴즈 풀기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "직접 풀어보기", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "다른 문제 살펴보기" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("FFT로 다항식 곱하기", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "코드로 풀기", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "이해했어요. 퀴즈 풀기" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "이해 확인으로 돌아가기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "개념과 예제로 돌아가기", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("region", { name: "개념에서 문제로" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const concept = await page.locator(".lesson-layout .prose").boundingBox(),
    example = await page.locator(".lesson-example-column").boundingBox();
  expect(example!.y).toBeGreaterThan(concept!.y + concept!.height);
  await page.screenshot({
    path: "test-results/learning-mobile-flow.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "이해했어요. 퀴즈 풀기", exact: true })
    .click();
  await expect(page.getByText(/문항 1 \/ 3/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "코드로 풀기", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "기본 개념", exact: true }),
  ).toHaveCount(0);
});

test("every concept includes a concrete purpose and application before the quiz screen", async ({
  page,
}) => {
  await authenticate(page);
  await page.goto("/");
  const { topics } = await (await page.request.get("/api/topics")).json();
  expect(topics).toHaveLength(47);
  for (const topic of topics) {
    await page
      .getByRole("button")
      .filter({
        has: page.getByRole("heading", { name: topic.title, exact: true }),
      })
      .click();
    const uses = page.getByRole("region", { name: "사용 용도" });
    await expect(
      uses.getByRole("heading", { name: "언제 사용하나요?" }),
    ).toBeVisible();
    await expect(
      uses.getByRole("heading", { name: "대표 활용 사례" }),
    ).toBeVisible();
    const descriptions = await uses.locator("p").allTextContents();
    expect(descriptions).toHaveLength(2);
    expect(descriptions.every((s: string) => s.length > 25)).toBe(true);
    await expect(
      page.getByRole("heading", { name: "잠깐, 이해했나요?", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "이해했어요. 퀴즈 풀기", exact: true })
      .click();
    await page
      .getByRole("button", { name: "직접 풀어보기", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "코드로 풀기", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/연습 문제를 준비 중/)).toHaveCount(0);
    await page
      .getByRole("button", { name: "이해 확인으로 돌아가기", exact: true })
      .click();
    await page
      .getByRole("button", { name: "개념과 예제로 돌아가기", exact: true })
      .click();
    await page.getByRole("button", { name: "학습 목록", exact: true }).click();
  }
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
  await page.unroute("**/api/records");
  await page.getByRole("button", { name: "작성 화면으로 돌아가기" }).click();
  await expect(
    page.getByRole("heading", { name: "내 기록", exact: true }),
  ).toBeVisible();
});

test("worker result contract renders actual supplied trace and strict outputs", async ({
  page,
}) => {
  await authenticate(page);
  const me = await (await page.request.get("/api/me")).json();
  const headers = { origin: "http://127.0.0.1:5173", "x-csrf-token": me.csrf };
  const record = await (
    await page.request.post("/api/records", {
      headers,
      data: { problemId: "bfs-v1", language: "java" },
    })
  ).json();
  const execution = await (
    await page.request.post(`/api/records/${record.id}/executions`, {
      headers,
      data: {
        requestKey: "browser-worker-contract",
        revision: 0,
        mode: "judge",
      },
    })
  ).json();
  const internal = { authorization: "Bearer e2e-runner-secret" };
  let job: any;
  for (let i = 0; i < 10; i++) {
    job = (
      await (
        await page.request.post("/api/internal/claim", {
          headers: internal,
          data: {},
        })
      ).json()
    ).job;
    if (job?.id === execution.id) break;
    if (job)
      await page.request.post(`/api/internal/executions/${job.id}/result`, {
        headers: internal,
        data: { token: job.token, systemError: "TEST_CLEANUP" },
      });
  }
  expect(job.id).toBe(execution.id);
  const trace = [
    {
      line: 8,
      event: "line",
      locals: {
        g: [[1], [0]],
        v: 0,
        q: [1],
        seen: [true, true],
        head: {
          $id: "java@1",
          $type: "Node",
          fields: { value: 7, next: { $ref: "java@1" } },
        },
      },
      stack: ["main"],
    },
    {
      line: 9,
      event: "line",
      locals: {
        g: [[1], [0]],
        v: 1,
        q: [],
        seen: [true, true],
        head: {
          $id: "java@1",
          $type: "Node",
          fields: { value: 7, next: { $ref: "java@1" } },
        },
      },
      stack: ["main"],
    },
  ];
  const result = await page.request.post(
    `/api/internal/executions/${job.id}/result`,
    {
      headers: internal,
      data: {
        token: job.token,
        result: {
          verdict: "WA",
          runnerImage: "explicit-browser-test-fixture",
          traceSupport: "JDI",
          tests: [
            {
              input: "2 1\n0 1\n0\n",
              expected: "0 1\n",
              actual: "0 1",
              stderr: "",
              verdict: "WA",
              elapsedMs: 13,
              peakMemoryBytes: 1048576,
              trace,
            },
          ],
        },
      },
    },
  );
  expect(result.ok()).toBe(true);
  await page.goto("/");
  await page.getByRole("button", { name: "내 기록", exact: true }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "그래프를 가까운 순서로 탐색하기" })
    .getByRole("button", { name: "이어서 보기" })
    .click();
  await expect(
    page.getByRole("img", { name: "그래프의 현재 방문 상태" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "다음 단계", exact: true }).click();
  await expect(page.getByText("2 / 2 단계")).toBeVisible();
  await expect(
    page.getByRole("img", { name: "객체 필드와 참조 관계" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "테스트 결과", exact: true }).click();
  await expect(page.getByText("13 ms", { exact: true })).toBeVisible();
  await expect(page.getByText('"0 1\\n"', { exact: true })).toBeVisible();
});
test("Android tablet remains learning-only at desktop width", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).AlgostepNative = { postMessage: () => {} };
  });
  await page.setViewportSize({ width: 1440, height: 900 });
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
});
test("mobile P0 examples accept input and display sorting and references", async ({
  page,
}) => {
  await authenticate(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /버블 정렬/ }).click();
  await page.getByLabel("예제 값", { exact: true }).fill("3, 1, 2");
  await page.getByRole("button", { name: "예제 적용 · 처음부터" }).click();
  const next = page.getByRole("button", { name: "다음 단계", exact: true });
  for (let i = 0; i < 8 && (await next.isEnabled()); i++) await next.click();
  await expect(page.getByText("정렬 완료", { exact: true })).toBeVisible();
  await expect(
    page.locator(".array-board .diagram-node > text:first-of-type"),
  ).toHaveText(["1", "2", "3"]);
  await page.getByRole("button", { name: "학습 목록", exact: true }).click();
  await page.getByRole("button", { name: /단일 연결 리스트/ }).click();
  await page.getByRole("button", { name: "다음 단계", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "객체 필드와 참조 관계" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-linked-list.png",
    fullPage: true,
  });
});
test("unexpected rendering errors provide a full-screen recovery action", async ({
  page,
}) => {
  await authenticate(page);
  await page.route("**/api/topics", (route) =>
    route.fulfill({
      json: {
        topics: [
          {
            id: "bad",
            title: "Malformed response",
            category: "test",
            priority: "P0",
            body: null,
          },
        ],
      },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "화면을 표시하지 못했어요" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "화면 다시 열기" }),
  ).toBeVisible();
});
