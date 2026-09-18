import { chromium } from "playwright";
import { DomainError } from "./domain.js";
import { snapshotSvg } from "./snapshot-svg.js";
const esc = (s: any) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export async function renderPdf({ record, problem, execution, reviews }: any) {
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.PDF_BROWSER_PATH || undefined,
      headless: true,
    });
  } catch {
    throw new DomainError(
      503,
      "PDF_UNAVAILABLE",
      "PDF 생성 환경이 준비되지 않았어요. 잠시 후 다시 시도해 주세요.",
    );
  }
  try {
    const page = await browser.newPage();
    await page.route("**/*", (route) => route.abort());
    const result = execution?.result;
    await page.setContent(
      `<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{font:12px sans-serif;color:#18213a}h1{font-size:24px}h2{margin-top:28px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f6f7fb;padding:14px}section{break-inside:avoid}small{color:#63708a}</style><h1>${esc(problem.title)}</h1><small>알고리즘 학습 기록 · ${esc(record.id)} · ${esc(new Date().toISOString())}</small><h2>문제</h2><p>${esc(problem.statement)}</p><p>${esc(problem.input_spec)}</p><p>${esc(problem.output_spec)}</p><h2>현재 저장 코드 · ${esc(record.language)}</h2><pre>${esc(record.source)}</pre><h2>최신 실행 · ${esc(execution?.status ?? "실행 전")}</h2>${execution ? `<h3>실행 당시 코드</h3><pre>${esc(execution.source)}</pre>` : ""}<p>${esc(result?.verdict ?? result?.systemError ?? "")}</p><h2>시간 · 공간 복잡도</h2><p>${esc(result?.analysis?.time ?? "분석 결과 없음")} / ${esc(result?.analysis?.space ?? "분석 결과 없음")}</p><p>${esc(result?.analysis?.evidence)}</p>${(
        result?.tests ?? []
      )
        .map(
          (t: any, i: number) =>
            `<section><h3>테스트 ${i + 1} · ${esc(t.verdict)}</h3><p>${t.elapsedMs} ms / ${t.peakMemoryBytes} bytes</p><h4>입력</h4><pre>${esc(t.input)}</pre><h4>예상 출력</h4><pre>${esc(t.expected ?? "사용자 입력 실행")}</pre><h4>실제 출력</h4><pre>${esc(t.actual)}</pre><h4>오류</h4><pre>${esc(t.stderr)}</pre><h4>자동 선택 실행 스냅샷</h4>${
              [
                0,
                Math.floor((t.trace?.length ?? 0) / 2),
                (t.trace?.length ?? 1) - 1,
              ]
                .filter((n, j, a) => a.indexOf(n) === j && t.trace?.[n])
                .map(
                  (n) =>
                    `<p>${esc(t.trace[n].line)}번째 줄</p>${snapshotSvg(t.trace[n], problem.topic_id)}<pre>${esc(JSON.stringify(t.trace[n], null, 2))}</pre>`,
                )
                .join("") ||
              "<p>이 실행에는 수집된 시각화 데이터가 없습니다.</p>"
            }</section>`,
        )
        .join(
          "",
        )}<h2>코드 리뷰</h2>${reviews.map((r: any) => `<section><h3>${esc(r.status)} · ${esc(r.created_at)}</h3><h4>리뷰 당시 코드</h4><pre>${esc(r.source)}</pre><h4>논리 오류</h4><pre>${esc(r.result?.logicalErrors)}</pre><h4>효율 개선</h4><pre>${esc(r.result?.efficiencyImprovements)}</pre><h4>대안 코드</h4><pre>${esc(r.result?.alternativeCode)}</pre></section>`).join("") || "<p>리뷰 없음</p>"}</html>`,
    );
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
    });
  } finally {
    await browser.close();
  }
}
