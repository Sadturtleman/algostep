import { track } from "./analytics.js";
import React, { useEffect, useState } from "react";
import { api, post } from "./api.js";
import { SupportPanel, Pager, displayTime } from "./SupportPanel.js";
const today = () =>
  new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const number = (n: number | string | null) =>
  n === null
    ? "미수집"
    : Number(n).toLocaleString("ko-KR", { maximumFractionDigits: 6 });
const money = (n: number | string, currency: string) =>
  `${number(n)} ${currency}`;
const eventLabels: Record<string, string> = {
  USER_REGISTERED: "회원 가입",
  LOGIN: "로그인",
  PRACTICE_STARTED: "코드 문제 시작",
  QUIZ_ANSWERED: "퀴즈 제출",
  EXECUTION_REQUESTED: "실행 요청",
  EXECUTION_FINISHED: "실행 결과",
  REVIEW_REQUESTED: "리뷰 요청",
  REVIEW_SUCCEEDED: "리뷰 완료",
  REVIEW_FAILED: "리뷰 실패",
  INQUIRY_CREATED: "문의 접수",
  INQUIRY_UPDATED: "문의 처리",
  COSTS_IMPORTED: "비용 가져오기",
  RECORD_DELETED: "학습 기록 삭제",
};
export function AdminDashboard() {
  const [tab, setTab] = useState("overview"),
    [from, setFrom] = useState(today().slice(0, 7) + "-01"),
    [to, setTo] = useState(today()),
    [grain, setGrain] = useState("day"),
    [query, setQuery] = useState(`from=${from}&to=${to}&grain=day`),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    track("ADMIN_SECTION_VIEWED", { section: tab });
  }, [tab]);
  useEffect(() => {
    let current = true;
    setData(null);
    setError("");
    api("/admin/dashboard?" + query)
      .then((d) => {
        if (current) setData(d);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [query, refresh]);
  return (
    <section className="dashboard">
      <div className="dashboard-heading">
        <div>
          <span className="eyebrow">ALGOSTEP / ADMIN</span>
          <h1>운영 대시보드</h1>
          <p>방문부터 학습, 문의까지 서비스의 흐름을 확인하세요.</p>
        </div>
        <button className="secondary" onClick={() => setRefresh((v) => v + 1)}>
          데이터 새로고침
        </button>
      </div>
      <nav className="dashboard-tabs" aria-label="관리자 메뉴">
        {[
          ["overview", "전체 현황"],
          ["finance", "비용·매출"],
          ["users", "사용자"],
          ["support", "문의"],
          ["events", "비즈니스 로그"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "" : "secondary"}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      <form
        className="dashboard-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(new URLSearchParams({ from, to, grain }).toString());
        }}
      >
        <label>
          시작일
          <input
            type="date"
            required
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          종료일
          <input
            type="date"
            required
            value={to}
            min={from}
            max={today()}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          집계 단위
          <select value={grain} onChange={(e) => setGrain(e.target.value)}>
            <option value="day">일별</option>
            <option value="week">주별</option>
            <option value="month">월별</option>
          </select>
        </label>
        <button>기간 적용</button>
        <small>
          KST · 최대 366일
          <br />
          주간: 월요일 시작 · 월간: 매월 1일 시작
        </small>
      </form>
      {error && (
        <p role="alert" className="dashboard-error">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">운영 데이터를 불러오는 중…</p>}
      {data && (
        <>
          <p className="dashboard-caption">
            조회 {data.range.from} ~ {data.range.to} · 갱신{" "}
            {displayTime(data.generatedAt)}
          </p>
          {tab === "overview" && (
            <>
              <div className="metric-grid">
                {[
                  [
                    "누적 접속자",
                    data.counts.cumulative,
                    "수집 시작 이후 고유 사용자",
                  ],
                  ["오늘 접속자", data.counts.daily, "KST 오늘"],
                  [
                    "이번 주 접속자",
                    data.counts.weekly,
                    "이번 주 월요일부터 오늘",
                  ],
                  [
                    "이번 달 접속자",
                    data.counts.monthly,
                    "이번 달 1일부터 오늘",
                  ],
                  ["전체 사용자", data.counts.users, "현재 등록된 계정"],
                  ["신규 사용자", data.counts.new_users, "선택 기간 가입 계정"],
                  [
                    "기간 접속자",
                    data.counts.period_visitors,
                    "선택 기간 중복 제거",
                  ],
                  ["미처리 문의", data.counts.open_inquiries, "접수 + 처리 중"],
                ].map(([title, value, note]) => (
                  <article className="metric-card" key={title}>
                    <span>{title}</span>
                    <strong>{number(value)}</strong>
                    <small>{note}</small>
                  </article>
                ))}
              </div>
              <p className="dashboard-caption">
                접속자는 로그인 계정 기준이며 관리자도 포함됩니다. 여러 기기로
                접속해도 한 명으로 집계합니다. 주·월 접속자는 일별 수의 합계가
                아닙니다. 수집 시작:{" "}
                {data.counts.tracking_since
                  ? displayTime(data.counts.tracking_since)
                  : "아직 접속 기록 없음"}{" "}
                · 도입 이전 방문은 소급 추정하지 않습니다. 기간 경계의 주·월은
                선택된 날짜만 집계합니다.
              </p>
              <section className="dashboard-panel">
                <h2>접속자와 신규 사용자 추이</h2>
                <Trend series={data.series} />
                <DataTable
                  headers={["기간 시작일", "고유 접속자", "신규 사용자"]}
                  rows={data.series.map((r: any) => [
                    r.period,
                    number(r.visitors),
                    number(r.new_users),
                  ])}
                />
              </section>
              <div className="dashboard-columns">
                <section className="dashboard-panel">
                  <h2>비용</h2>
                  {data.costs.length ? (
                    data.costs.map((r: any) => (
                      <p key={r.currency}>
                        <strong>{money(r.amount, r.currency)}</strong> · 수집한
                        비용 {r.entries}건
                      </p>
                    ))
                  ) : (
                    <p>비용 자료 미수집</p>
                  )}
                  <p className="muted">
                    선택 기간에 가져온 실비만 표시합니다. 미수집은 0원과
                    다릅니다.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => setTab("finance")}
                  >
                    비용·매출 상세
                  </button>
                </section>
                <section className="dashboard-panel">
                  <h2>매출액</h2>
                  {data.revenue.length ? (
                    data.revenue.map((r: any) => (
                      <p key={r.currency}>순매출 {money(r.net, r.currency)}</p>
                    ))
                  ) : (
                    <p>0 KRW · 결제 미연동</p>
                  )}
                  <p className="muted">
                    결제액에서 환불액을 뺀 금액입니다. 무료 리뷰는 매출에
                    포함하지 않습니다.
                  </p>
                </section>
              </div>
              <section className="dashboard-panel">
                <h2>주요 비즈니스 활동</h2>
                <DataTable
                  headers={["이벤트", "발생 수"]}
                  rows={data.events.map((r: any) => [
                    eventLabels[r.type] ?? r.type,
                    number(r.count),
                  ])}
                />
                <p className="muted">
                  수집 시작 이후의 이벤트입니다. 방문 통계는 별도 중복 제거
                  집계입니다.
                </p>
              </section>
            </>
          )}
          {tab === "finance" && (
            <Finance
              data={data}
              query={query}
              refresh={refresh}
              onImport={() => setRefresh((v) => v + 1)}
            />
          )}
          {tab === "users" && (
            <PagedList
              key={"users:" + refresh}
              path="/admin/users"
              title="사용자 목록"
              headers={["이름", "이메일", "가입 일시 (KST)", "마지막 접속일"]}
              map={(r) => [
                r.display_name,
                r.email,
                displayTime(r.created_at),
                r.last_visit ?? "수집 기록 없음",
              ]}
            />
          )}
          {tab === "support" && (
            <SupportPanel key={"support:" + refresh} admin />
          )}
          {tab === "events" && (
            <EventList
              key={query + ":" + refresh}
              query={query}
              events={data.events}
            />
          )}
        </>
      )}
    </section>
  );
}
function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="dashboard-table">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th scope="col" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, i) => (
              <tr key={i}>
                {row.map((v, j) => (
                  <td key={j}>{v}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={headers.length}>
                해당 기간에 수집된 데이터가 없어요.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function Trend({ series }: { series: any[] }) {
  const max = Math.max(1, ...series.flatMap((r) => [r.visitors, r.new_users]));
  const points = (key: string) =>
    series
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r[key] !== null)
      .map(
        ({ r, i }) =>
          `${40 + (i * 720) / Math.max(1, series.length - 1)},${190 - (r[key] / max) * 150}`,
      )
      .join(" ");
  return (
    <>
      <div className="chart-legend">
        <span>● 접속자</span>
        <span>● 신규 사용자</span>
      </div>
      <svg
        className="dashboard-chart"
        viewBox="0 0 800 240"
        role="img"
        aria-label="기간별 고유 접속자와 신규 사용자 추이. 상세 수치는 아래 표에서 확인할 수 있습니다."
      >
        <text x="4" y="40">
          {number(max)}
        </text>
        <text x="16" y="194">
          0
        </text>
        <line x1="40" y1="190" x2="760" y2="190" stroke="var(--border)" />
        <polyline
          points={points("visitors")}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
        />
        <polyline
          points={points("new_users")}
          fill="none"
          stroke="var(--success)"
          strokeWidth="3"
          strokeDasharray="6 4"
        />
        {series.map((r, i) =>
          r.visitors === null ? null : (
            <circle
              key={r.period}
              cx={40 + (i * 720) / Math.max(1, series.length - 1)}
              cy={190 - (r.visitors / max) * 150}
              r="3"
              fill="var(--accent)"
            >
              <title>
                {r.period}: 접속자 {r.visitors}, 신규 {r.new_users}
              </title>
            </circle>
          ),
        )}
        <text x="40" y="225">
          {series[0]?.period}
        </text>
        <text x="760" y="225" textAnchor="end">
          {series.at(-1)?.period}
        </text>
      </svg>
    </>
  );
}
function PagedList({
  path,
  title,
  headers,
  map,
}: {
  path: string;
  title: string;
  headers: string[];
  map: (r: any) => React.ReactNode[];
}) {
  const [page, setPage] = useState(1),
    [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    api(path + (path.includes("?") ? "&" : "?") + "page=" + page)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [path, page]);
  return (
    <section className="dashboard-panel">
      <h2>{title}</h2>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>불러오는 중…</p>}
      {data && (
        <>
          <DataTable headers={headers} rows={data.rows.map(map)} />
          <Pager page={page} more={data.hasMore} onChange={setPage} />
        </>
      )}
    </section>
  );
}
function EventList({ query, events }: { query: string; events: any[] }) {
  const [type, setType] = useState("");
  return (
    <>
      <AnalyticsConnections />
      <label className="dashboard-filter">
        이벤트 종류
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">전체</option>
          {events.map((e) => (
            <option key={e.type} value={e.type}>
              {eventLabels[e.type] ?? e.type}
            </option>
          ))}
        </select>
      </label>
      <PagedList
        key={type}
        path={"/admin/events?" + query + (type ? "&type=" + type : "")}
        title="비즈니스 이벤트 기록"
        headers={["발생 일시 (KST)", "이벤트", "사용자 ID", "상세"]}
        map={(r) => [
          displayTime(r.created_at),
          eventLabels[r.type] ?? r.type,
          r.actor_id ?? "시스템",
          JSON.stringify(r.metadata),
        ]}
      />
      <p className="muted">
        코드·문의 본문·인증 토큰은 비즈니스 로그에 저장하지 않습니다.
      </p>
    </>
  );
}
function AnalyticsConnections() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api("/admin/analytics")
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const labels: Record<string, string> = {
    PENDING: "대기",
    PROCESSING: "전송 중",
    ACCEPTED: "HTTP 수신 확인",
    REJECTED: "거절",
    UNCERTAIN: "수신 여부 불명",
    EXPIRED: "전송 기한 만료",
  };
  return (
    <section className="dashboard-panel">
      <h2>GA4 · Redash 연결 상태</h2>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>연결 상태를 불러오는 중…</p>}
      {data && (
        <>
          <p>
            GA4:{" "}
            {data.ga4.configured
              ? `전송 설정 완료 · ${data.ga4.measurementId}`
              : "연결 설정 대기"}
          </p>
          <p>
            Redash:{" "}
            {data.redash.url ? (
              <a href={data.redash.url} target="_blank" rel="noreferrer">
                분석 대시보드 열기
              </a>
            ) : (
              "연결 설정 대기"
            )}
          </p>
          <DataTable
            headers={["전송 상태", "이벤트 수", "상태 코드"]}
            rows={data.ga4.states.map((r: any) => [
              labels[r.status] ?? r.status,
              number(r.count),
              r.last_code ?? "—",
            ])}
          />
          <p className="muted">
            현재 {data.catalog.length}종 이벤트를 수집합니다. GA4의 HTTP 수신
            확인은 보고서 반영 완료를 뜻하지 않습니다. 수신 여부가 불명확한 건은
            중복 집계를 막기 위해 자동 재전송하지 않으며, 원본 이벤트는
            데이터베이스에 남습니다.
          </p>
        </>
      )}
    </section>
  );
}
function Finance({
  data,
  query,
  refresh,
  onImport,
}: {
  data: any;
  query: string;
  refresh: number;
  onImport: () => void;
}) {
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [entries, setEntries] = useState<any[] | null>(null);
  return (
    <>
      <div className="dashboard-columns">
        <section className="dashboard-panel">
          <h2>기간 비용 · 수집분</h2>
          {data.costs.length ? (
            data.costs.map((r: any) => (
              <p key={r.currency}>
                <strong>{money(r.amount, r.currency)}</strong>
                <br />
                <small>최종 반영: {displayTime(r.updated_at)}</small>
              </p>
            ))
          ) : (
            <p>비용 자료 미수집</p>
          )}
          <p>
            GCP·Gemini·Supabase의 청구 자료를 가져오면 반영됩니다. 계정
            크레딧·세금·지연 반영은 청구서와 대조해 주세요. 통화 간 합산은 하지
            않습니다.
          </p>
        </section>
        <section className="dashboard-panel">
          <h2>매출액과 환불</h2>
          <p>현재 PG 결제 미연동 · 신규 유료 결제 비활성</p>
          {data.revenue.length ? (
            <DataTable
              headers={["통화", "결제액", "환불액", "순매출"]}
              rows={data.revenue.map((r: any) => [
                r.currency,
                number(r.gross),
                number(r.refunds),
                number(r.net),
              ])}
            />
          ) : (
            <strong>결제 0 KRW · 환불 0 KRW · 순매출 0 KRW</strong>
          )}
          <p className="muted">
            매출은 검증된 결제·환불 이벤트만 반영하도록 원장을 분리했습니다. PG
            연동 전에는 임의 매출을 입력할 수 없습니다.
          </p>
        </section>
      </div>
      <section className="dashboard-panel">
        <h2>기간별 비용과 순매출</h2>
        {["KRW", "USD"].map((currency) => {
          const points = data.series.map((r: any) => ({
            period: r.period,
            cost: data.costSeries.find(
              (c: any) => c.period === r.period && c.currency === currency,
            )?.amount,
            revenue: data.revenueSeries.find(
              (c: any) => c.period === r.period && c.currency === currency,
            )?.amount,
          }));
          if (
            !points.some(
              (p: any) => p.cost !== undefined || p.revenue !== undefined,
            )
          )
            return null;
          const max = Math.max(
            1,
            ...points.map((p: any) => Math.abs(Number(p.cost ?? 0))),
          );
          return (
            <div key={currency}>
              <h3>{currency}</h3>
              <div
                className="cost-bars"
                aria-label={`${currency} 수집된 비용 추이`}
              >
                {points
                  .filter((p: any) => p.cost !== undefined)
                  .map((p: any) => (
                    <div className="cost-bar-row" key={p.period}>
                      <span>{p.period}</span>
                      <div>
                        <i
                          style={{
                            width: `${(Math.abs(Number(p.cost)) / max) * 100}%`,
                            background:
                              Number(p.cost) < 0
                                ? "var(--success)"
                                : "var(--accent)",
                          }}
                        />
                      </div>
                      <b>{money(p.cost, currency)}</b>
                    </div>
                  ))}
              </div>
              <DataTable
                headers={["기간 시작일", "수집된 비용", "순매출"]}
                rows={points.map((p: any) => [
                  p.period,
                  p.cost === undefined ? "미수집" : money(p.cost, currency),
                  p.revenue === undefined
                    ? "결제 없음"
                    : money(p.revenue, currency),
                ])}
              />
            </div>
          );
        })}
        {!data.costSeries.length && !data.revenueSeries.length && (
          <p>수집된 비용·매출이 생기면 차트와 표가 표시됩니다.</p>
        )}
      </section>
      <section className="dashboard-panel">
        <h2>Gemini 등 LLM 실제 사용량</h2>
        <DataTable
          headers={[
            "제공사 / 모델",
            "응답 수",
            "토큰 수집 응답",
            "입력 토큰",
            "출력 토큰",
            "Thinking 토큰",
          ]}
          rows={data.usage.map((r: any) => [
            r.provider + " / " + r.model,
            number(r.calls),
            number(r.measured_calls),
            number(r.input_tokens),
            number(r.output_tokens),
            number(r.thinking_tokens),
          ])}
        />
        <p className="muted">
          공급자가 반환한 사용량입니다. 토큰만으로 청구 금액을 확정하지 않으며
          비용 원장과 중복 합산하지 않습니다. 응답을 받지 못한 호출 비용은 청구
          자료에서 확인해야 합니다.
        </p>
      </section>
      <section className="dashboard-panel">
        <h2>비용 자료 가져오기</h2>
        <p>
          검토한 JSON 파일을 선택한 뒤 적용하세요. 같은 sourceKey는 갱신되어
          중복 합산되지 않습니다. 한 파일 최대 500행 · 512KB.
        </p>
        <p className="muted">
          행 필드: sourceKey, usageDate (YYYY-MM-DD), service, currency
          (KRW/USD), amount, source. amount는 크레딧 반영 후 비용이며 음수
          조정도 허용합니다.
        </p>
        <a href="/cost-import-example.json" download>
          JSON 형식 예제 다운로드
        </a>
        <label className="dashboard-filter">
          비용 JSON 파일
          <input
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={async (e) => {
              setEntries(null);
              setNotice("");
              setError("");
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 512000)
                  throw new Error("512KB 이하 파일을 선택해 주세요.");
                const parsed = JSON.parse(await file.text());
                if (
                  !Array.isArray(parsed.entries) ||
                  !parsed.entries.length ||
                  parsed.entries.length > 500
                )
                  throw new Error("entries에 1~500개 행이 필요해요.");
                setEntries(parsed.entries);
              } catch (e: any) {
                setError(e.message);
              }
            }}
          />
        </label>
        {entries && (
          <>
            <p>
              미리보기: {entries.length}행 · 적용 전 원본 키·금액을 확인해
              주세요.
            </p>
            <DataTable
              headers={["원본 키", "날짜", "서비스", "통화", "금액"]}
              rows={entries
                .slice(0, 10)
                .map((e) => [
                  String(e.sourceKey ?? ""),
                  String(e.usageDate ?? ""),
                  String(e.service ?? ""),
                  String(e.currency ?? ""),
                  String(e.amount ?? ""),
                ])}
            />
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const result = await post("/admin/costs/import", { entries });
                  setEntries(null);
                  setNotice(`${result.imported}건을 반영했어요.`);
                  onImport();
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "반영 중…" : "비용 자료 적용"}
            </button>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
      </section>
      <PagedList
        key={query + ":" + refresh}
        path={"/admin/costs?" + query}
        title="비용 원장"
        headers={["사용일", "서비스", "비용", "출처", "원본 키"]}
        map={(r) => [
          r.usage_date,
          r.service,
          money(r.amount, r.currency),
          r.source,
          r.source_key,
        ]}
      />
    </>
  );
}
