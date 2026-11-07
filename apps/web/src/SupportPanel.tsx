import React, { useEffect, useRef, useState } from "react";
import { api, post } from "./api.js";
export const ticketLabels: Record<string, string> = {
  OPEN: "접수",
  IN_PROGRESS: "처리 중",
  RESOLVED: "완료",
};
export const displayTime = (v: string) =>
  new Date(v).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
export function Pager({
  page,
  more,
  onChange,
}: {
  page: number;
  more: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="dashboard-pagination">
      <button
        className="secondary"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        이전 페이지
      </button>
      <span>{page} 페이지</span>
      <button
        className="secondary"
        disabled={!more}
        onClick={() => onChange(page + 1)}
      >
        다음 페이지
      </button>
    </div>
  );
}
export function SupportPanel({ admin = false }: { admin?: boolean }) {
  const [data, setData] = useState<any>(null),
    [page, setPage] = useState(1),
    [status, setStatus] = useState(""),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [subject, setSubject] = useState(""),
    [body, setBody] = useState(""),
    [category, setCategory] = useState("question");
  const requestKey = useRef(crypto.randomUUID());
  const endpoint = admin ? "/admin/inquiries" : "/support";
  useEffect(() => {
    let current = true;
    setData(null);
    setError("");
    api(`${endpoint}?page=${page}${status ? "&status=" + status : ""}`)
      .then((d) => {
        if (current) setData(d);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [endpoint, page, status, revision]);
  return (
    <section className="dashboard support-panel">
      <div className="dashboard-heading">
        <div>
          <span className="eyebrow">
            {admin ? "CUSTOMER SUPPORT" : "HELP & FEEDBACK"}
          </span>
          <h1>{admin ? "문의 관리" : "문의하기"}</h1>
          <p>
            {admin
              ? "사용자의 문의를 확인하고 답변과 처리 상태를 관리하세요."
              : "문의와 답변은 이 화면에서 확인할 수 있어요. 비밀번호나 API 키는 적지 마세요."}
          </p>
        </div>
        <button className="secondary" onClick={() => setRevision((v) => v + 1)}>
          목록 새로고침
        </button>
      </div>
      {error && (
        <p role="alert" className="dashboard-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {!admin && (
        <form
          className="dashboard-panel dashboard-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setNotice("");
            try {
              await post("/support", {
                subject,
                body,
                category,
                requestKey: requestKey.current,
              });
              requestKey.current = crypto.randomUUID();
              setSubject("");
              setBody("");
              setPage(1);
              setStatus("");
              setRevision((v) => v + 1);
              setNotice(
                "문의가 접수됐어요. 아래 목록에서 답변을 확인해 주세요.",
              );
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            문의 유형
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="question">이용 문의</option>
              <option value="bug">오류 제보</option>
              <option value="billing">결제 문의</option>
              <option value="other">기타</option>
            </select>
          </label>
          <label>
            제목
            <input
              required
              maxLength={120}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label>
            문의 내용
            <textarea
              required
              maxLength={5000}
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <button disabled={busy}>{busy ? "접수 중…" : "문의 접수"}</button>
        </form>
      )}
      <label className="dashboard-filter">
        처리 상태
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">전체</option>
          {Object.entries(ticketLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      {!data && !error && <p role="status">문의를 불러오는 중…</p>}
      {data && (
        <>
          <p>{data.rows.length === 0 ? "아직 문의가 없어요." : ""}</p>
          {data.rows.map((t: any) => (
            <Ticket
              key={t.id + ":" + t.revision}
              ticket={t}
              admin={admin}
              onSave={() => {
                setRevision((v) => v + 1);
                setNotice("문의 상태와 답변을 저장했어요.");
              }}
            />
          ))}
          <Pager page={page} more={data.hasMore} onChange={setPage} />
        </>
      )}
    </section>
  );
}
function Ticket({
  ticket: t,
  admin,
  onSave,
}: {
  ticket: any;
  admin: boolean;
  onSave: () => void;
}) {
  const [reply, setReply] = useState(t.reply),
    [status, setStatus] = useState(t.status),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <article className="dashboard-panel ticket">
      <div className="dashboard-heading">
        <h2>{t.subject}</h2>
        <span className="badge">{ticketLabels[t.status]}</span>
      </div>
      <small>
        {displayTime(t.created_at)} · {admin ? t.email : "내 문의"} ·{" "}
        {t.category}
      </small>
      <p className="preserve-lines">{t.body}</p>
      {admin ? (
        <form
          className="dashboard-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api("/admin/inquiries/" + t.id, {
                method: "PATCH",
                body: JSON.stringify({ reply, status, revision: t.revision }),
              });
              onSave();
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            사용자에게 보여줄 답변
            <textarea
              value={reply}
              rows={4}
              maxLength={5000}
              onChange={(e) => setReply(e.target.value)}
            />
          </label>
          <label>
            문의 처리 상태
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(ticketLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          {error && <p role="alert">{error}</p>}
          <button disabled={busy}>
            {busy ? "저장 중…" : "답변 및 상태 저장"}
          </button>
        </form>
      ) : t.reply ? (
        <div className="ticket-reply">
          <h3>관리자 답변</h3>
          <p className="preserve-lines">{t.reply}</p>
          <small>{displayTime(t.updated_at)}</small>
        </div>
      ) : (
        <p className="muted">아직 답변이 등록되지 않았어요.</p>
      )}
    </article>
  );
}
