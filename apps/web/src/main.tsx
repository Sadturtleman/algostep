import { QuizPanel } from "./QuizPanel.js";
import React, { useState, useEffect, useRef, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  Code2,
  History,
  ArrowRight,
  Sun,
  Moon,
  WifiOff,
  AlertCircle,
  Play,
  FileDown,
  GitBranch,
  Search,
  Check,
  ArrowLeft,
} from "lucide-react";
import {
  api,
  post,
  setCsrf,
  ApiError,
  loadGoogle,
  uploadDrive,
} from "./api.js";
import { TraceViewer, LessonDiagram } from "./visualization.js";
import "./style.css";
const Editor = lazy(() => import("./CodeEditor.js"));
const labels: any = { python: "Python 3.10", cpp: "C++20", java: "Java 21" };
const nativeAndroid = !!window.AlgostepNative;
function App() {
  const [config, setConfig] = useState<any>(null),
    [user, setUser] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState("home"),
    [topics, setTopics] = useState<any[]>([]),
    [problems, setProblems] = useState<any[]>([]),
    [records, setRecords] = useState<any[]>([]),
    [topic, setTopic] = useState<any>(null),
    [record, setRecord] = useState<any>(null),
    [source, setSource] = useState(""),
    [language, setLanguage] = useState("python"),
    [saveStatus, setSaveStatus] = useState("저장됨"),
    [error, setError] = useState<ApiError | null>(null),
    [theme, setTheme] = useState(
      () =>
        localStorage.getItem("theme") ??
        (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light"),
    ),
    [mobile, setMobile] = useState(() => nativeAndroid || innerWidth < 850),
    [usage, setUsage] = useState<any>(null),
    [filter, setFilter] = useState(""),
    [busy, setBusy] = useState(false),
    [input, setInput] = useState(""),
    [testIndex, setTestIndex] = useState(0),
    [tab, setTab] = useState("visual"),
    [notice, setNotice] = useState("");
  const googleRef = useRef<HTMLDivElement>(null),
    identityRef = useRef<string | null>(null),
    recordRef = useRef<any>(null),
    codeRef = useRef({ source: "", language: "python" }),
    saveQueue = useRef(Promise.resolve<any>(null)),
    lastSaved = useRef({ source: "", language: "python" }),
    runKey = useRef<string | null>(null),
    reviewKey = useRef<string | null>(null);
  const shownExecutionErrors = useRef(new Set<string>());
  const fail = (e: any) =>
    setError(
      e instanceof ApiError
        ? e
        : new ApiError("SYSTEM_ERROR", "요청을 처리하지 못했어요.", 500),
    );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);
  useEffect(() => {
    const resize = () => setMobile(nativeAndroid || innerWidth < 850);
    addEventListener("resize", resize);
    return () => removeEventListener("resize", resize);
  }, []);
  const loadData = async () => {
    if (nativeAndroid) {
      const a = await api("/topics");
      setTopics(a.topics);
      return;
    }
    const [a, b, c, d] = await Promise.all([
      api("/topics"),
      api("/problems"),
      api("/records"),
      api("/review-usage"),
    ]);
    setTopics(a.topics);
    setProblems(b.problems);
    setRecords(c.records);
    setUsage(d);
  };
  useEffect(() => {
    void (async () => {
      try {
        setConfig(await api("/config"));
        try {
          const me = await api("/me");
          setUser(me.user);
          identityRef.current = me.user.id;
          setCsrf(me.csrf);
          await loadData();
        } catch (e) {
          if (!(e instanceof ApiError) || e.status !== 401) throw e;
        }
      } catch (e) {
        fail(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  useEffect(() => {
    if (user || !config?.googleClientId || loading) return;
    if (nativeAndroid) {
      window.AlgostepNative!.onmessage = async ({ data }) => {
        try {
          const value = JSON.parse(data);
          if (value.error)
            throw new ApiError("AUTH_UNAVAILABLE", value.error, 401);
          const session = await post("/auth/google", {
            credential: value.credential,
            client: "android",
          });
          setCsrf(session.csrf);
          setUser(session.user);
          identityRef.current = session.user.id;
          await loadData();
          setError(null);
          setBusy(false);
        } catch (e) {
          setBusy(false);
          fail(e);
        }
      };
      return () => {
        window.AlgostepNative!.onmessage = undefined;
      };
    }
    void loadGoogle()
      .then(() => {
        window.google.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: async (r: any) => {
            try {
              const session = await post("/auth/google", {
                credential: r.credential,
              });
              if (
                identityRef.current &&
                identityRef.current !== session.user.id
              ) {
                recordRef.current = null;
                setRecord(null);
                setSource("");
                setPage("home");
                codeRef.current = { source: "", language: "python" };
                lastSaved.current = { ...codeRef.current };
              }
              identityRef.current = session.user.id;
              setUser(session.user);
              setCsrf(session.csrf);
              await loadData();
              setError(null);
            } catch (e) {
              fail(e);
            }
          },
        });
        if (googleRef.current) {
          googleRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(googleRef.current, {
            theme: theme === "dark" ? "filled_black" : "outline",
            size: "large",
            width: 300,
            locale: "ko",
          });
        }
      })
      .catch(() =>
        fail(
          new ApiError(
            "AUTH_UNAVAILABLE",
            "Google 로그인에 연결하지 못했어요.",
            503,
          ),
        ),
      );
  }, [user, config, loading, theme]);
  function editCode(value: string, lang = language) {
    codeRef.current = { source: value, language: lang };
    setSource(value);
    setLanguage(lang);
    setSaveStatus("저장 중…");
  }
  const save = () => {
    const r = recordRef.current;
    if (!r) return Promise.resolve(null);
    const code = { ...codeRef.current };
    saveQueue.current = saveQueue.current
      .catch(() => null)
      .then(async () => {
        if (recordRef.current?.id !== r.id) return null;
        if (
          code.source === lastSaved.current.source &&
          code.language === lastSaved.current.language
        )
          return recordRef.current;
        const updated = await api(`/records/${r.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            ...code,
            revision: recordRef.current.revision,
          }),
        });
        recordRef.current = { ...recordRef.current, ...updated };
        lastSaved.current = code;
        setRecord((old: any) =>
          old?.id === r.id ? { ...old, ...updated } : old,
        );
        setSaveStatus(
          codeRef.current.source === code.source &&
            codeRef.current.language === code.language
            ? "저장됨"
            : "저장 중…",
        );
        return recordRef.current;
      });
    return saveQueue.current;
  };
  useEffect(() => {
    if (!record) return;
    const timer = setTimeout(() => {
      void save().catch((e) => {
        setSaveStatus("저장 실패");
        fail(e);
      });
    }, 650);
    return () => clearTimeout(timer);
  }, [source, language]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (
        codeRef.current.source !== lastSaved.current.source ||
        codeRef.current.language !== lastSaved.current.language
      ) {
        e.preventDefault();
      }
    };
    addEventListener("beforeunload", handler);
    return () => removeEventListener("beforeunload", handler);
  }, []);
  useEffect(() => {
    if (!record?.id || !user || error) return;
    const timer = setInterval(async () => {
      try {
        const fresh = await api(`/records/${record.id}`);
        if (
          fresh.execution?.status === "FAILED" &&
          !shownExecutionErrors.current.has(fresh.execution.id)
        ) {
          shownExecutionErrors.current.add(fresh.execution.id);
          fail(
            new ApiError(
              "RUNNER_INTERRUPTED",
              "실행 환경 연결이 끊겼어요. 코드 오답으로 처리하지 않았습니다. 현재 코드를 유지한 채 다시 실행할 수 있어요.",
              503,
            ),
          );
        }
        setRecord((old: any) =>
          old?.id === fresh.id
            ? {
                ...old,
                reviews: fresh.reviews,
                execution:
                  old.execution?.id === fresh.execution?.id &&
                  old.execution?.status === fresh.execution?.status &&
                  old.execution?.finished_at === fresh.execution?.finished_at
                    ? old.execution
                    : fresh.execution,
              }
            : old,
        );
        if (usage && fresh.reviews?.some((r: any) => r.status === "SUCCEEDED"))
          setUsage(await api("/review-usage"));
      } catch (e) {
        if (
          e instanceof ApiError &&
          (e.status === 401 || e.code === "NETWORK_ERROR")
        )
          fail(e);
      }
    }, 2200);
    return () => clearInterval(timer);
  }, [record?.id, user, error]);
  const openRecord = async (id: string) => {
    await save();
    const r = await api(`/records/${id}`);
    recordRef.current = r;
    lastSaved.current = { source: r.source, language: r.language };
    codeRef.current = { ...lastSaved.current };
    setRecord(r);
    setSource(r.source);
    setLanguage(r.language);
    setSaveStatus("저장됨");
    setPage("workspace");
    setInput(
      problems.find((p) => p.id === r.problem_id)?.tests[0]?.input ?? "",
    );
    setTestIndex(0);
    runKey.current = null;
    reviewKey.current = null;
  };
  const navigate = async (next: string) => {
    try {
      await save();
      setPage(next);
      if (next === "history") await loadData();
    } catch (e) {
      fail(e);
    }
  };
  const run = async (mode: "judge" | "custom") => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await save();
      runKey.current ??= crypto.randomUUID();
      const execution = await post(`/records/${r.id}/executions`, {
        requestKey: runKey.current,
        revision: r.revision,
        mode,
        input,
      });
      runKey.current = null;
      setRecord((old: any) => ({ ...old, execution }));
      setTestIndex(0);
      setTab("visual");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const review = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await save();
      reviewKey.current ??= crypto.randomUUID();
      await post(`/records/${r.id}/reviews`, {
        requestKey: reviewKey.current,
        revision: r.revision,
      });
      reviewKey.current = null;
      setRecord(await api(`/records/${r.id}`));
      setUsage(await api("/review-usage"));
      setTab("review");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const exportPdf = async (drive = false) => {
    setBusy(true);
    try {
      await save();
      const r = await fetch(`/api/records/${record.id}/pdf`, {
        credentials: "include",
      });
      if (!r.ok) {
        const e = await r.json();
        throw new ApiError(e.code, e.message, r.status);
      }
      const blob = await r.blob();
      if (drive) {
        await uploadDrive(
          blob,
          config.googleClientId,
          `알고리즘-${problem.title}.pdf`,
        );
        setNotice("Google Drive에 PDF를 저장했어요.");
      } else {
        const url = URL.createObjectURL(blob),
          a = document.createElement("a");
        a.href = url;
        a.download = `알고리즘-${problem.title}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const problem = problems.find((p) => p.id === record?.problem_id),
    selectedTest = record?.execution?.result?.tests?.[testIndex];
  const errorTitle =
    error?.code === "NETWORK_ERROR"
      ? "연결이 잠시 끊겼어요"
      : error?.status === 401
        ? "다시 로그인해 주세요"
        : error?.code === "REVIEW_LIMIT"
          ? "이번 달 무료 리뷰를 모두 사용했어요"
          : error?.code === "SAVE_CONFLICT"
            ? "저장된 코드가 변경됐어요"
            : "잠시 이용할 수 없어요";
  const header = (
    <header>
      <button className="brand" onClick={() => void navigate("home")}>
        <img src="/logo.svg" alt="" width="38" height="38" />
        <b>알고리즘</b>
      </button>
      {user && (
        <nav>
          <button
            className={
              page === "home" || page === "lesson" ? "nav active" : "nav"
            }
            onClick={() => void navigate("home")}
          >
            <BookOpen size={18} />
            학습 홈
          </button>
          {!mobile && (
            <>
              <button
                className={
                  page === "problems" || page === "workspace"
                    ? "nav active"
                    : "nav"
                }
                onClick={() => void navigate("problems")}
              >
                <Code2 size={18} />
                문제 풀기
              </button>
              <button
                className={page === "history" ? "nav active" : "nav"}
                onClick={() => void navigate("history")}
              >
                <History size={18} />내 기록
              </button>
            </>
          )}
        </nav>
      )}
      <div className="header-right">
        <button
          className="icon-button"
          aria-label="테마 변경"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        {user && (
          <button
            className="account"
            onClick={() => {
              void save()
                .then(() => post("/auth/logout", {}))
                .then(() =>
                  window.AlgostepNative?.postMessage(
                    JSON.stringify({ type: "logout" }),
                  ),
                )
                .then(() => {
                  setUser(null);
                  setRecord(null);
                  recordRef.current = null;
                  setPage("home");
                })
                .catch(fail);
            }}
            title="로그아웃"
          >
            {user.name ?? user.display_name}
          </button>
        )}
      </div>
    </header>
  );
  if (loading)
    return (
      <>
        {header}
        <main className="center">
          <div className="spinner" />
          <p>학습 공간을 준비하고 있어요.</p>
        </main>
      </>
    );
  if (error)
    return (
      <>
        {header}
        <main className="system-error">
          <div className="error-icon">
            {error.code === "NETWORK_ERROR" ? (
              <WifiOff size={40} />
            ) : (
              <AlertCircle size={40} />
            )}
          </div>
          <span className="eyebrow">다시 이어갈 수 있어요</span>
          <h1>{errorTitle}</h1>
          <p>{error.message}</p>
          {record && (
            <div className="preserved">
              <Code2 size={20} />
              <div>
                <strong>현재 탭의 작성 코드는 유지하고 있어요.</strong>
                <p>
                  저장 상태: {saveStatus}. 저장 실패 시 서버 보관은 보장되지
                  않아요.
                </p>
              </div>
            </div>
          )}
          <div className="actions">
            <button
              onClick={async () => {
                if (error.status === 401) {
                  setUser(null);
                  setError(null);
                  return;
                }
                try {
                  if (!config) setConfig(await api("/config"));
                  if (error.code === "NETWORK_ERROR" && user) {
                    await loadData();
                    if (saveStatus === "저장 실패") await save();
                  }
                  setError(null);
                } catch (e) {
                  fail(e);
                }
              }}
            >
              {error.status === 401
                ? "Google 로그인으로 돌아가기"
                : "작성 화면으로 돌아가기"}
            </button>
            {record && (
              <button
                className="secondary"
                onClick={() =>
                  navigator.clipboard
                    .writeText(codeRef.current.source)
                    .then(() => setNotice("코드를 복사했어요."))
                    .catch(() => {})
                }
              >
                코드 복사
              </button>
            )}
          </div>
          <small>{error.code}</small>
          {notice && <p role="status">{notice}</p>}
        </main>
      </>
    );
  if (!user)
    return (
      <>
        {header}
        <main className="login">
          <div>
            <span className="eyebrow">ALGORITHM LEARNING STUDIO</span>
            <h1>
              정답 너머의
              <br />
              <span>흐름을 이해하다.</span>
            </h1>
            <p className="lead">
              코드 한 줄이 자료구조를 어떻게 바꾸는지.
              <br />
              직접 보고, 움직이고, 나만의 풀이로 익혀보세요.
            </p>
            <div className="login-features">
              <span>
                <Check size={17} /> 단계별 실행 시각화
              </span>
              <span>
                <Check size={17} /> 공개 테스트로 학습
              </span>
              <span>
                <Check size={17} /> 시간·공간 복잡도 분석
              </span>
            </div>
            <div ref={googleRef} />
            {nativeAndroid && (
              <button
                disabled={busy || !config?.googleClientId}
                onClick={async () => {
                  try {
                    setBusy(true);
                    const { nonce } = await post("/auth/challenge", {});
                    window.AlgostepNative!.postMessage(
                      JSON.stringify({
                        type: "login",
                        nonce,
                        clientId: config.googleClientId,
                      }),
                    );
                  } catch (e) {
                    setBusy(false);
                    fail(e);
                  }
                }}
              >
                Google로 로그인
              </button>
            )}
            {!config?.googleClientId && (
              <p className="setup-note">
                Google 로그인이 아직 연결되지 않았어요.
                <br />
                서버의 GOOGLE_CLIENT_ID 설정이 필요합니다.
              </p>
            )}
            <small>Google 계정으로 로그인하면 학습을 시작할 수 있어요.</small>
          </div>
          <div className="login-visual">
            <div className="section-heading">
              <span className="badge">BINARY SEARCH</span>
              <span>03 / 03</span>
            </div>
            <h2>
              범위는 줄이고,
              <br />
              이해는 넓히고.
            </h2>
            <div className="array">
              {[2, 5, 8, 13, 21, 34].map((n, i) => (
                <div className={`cell ${n === 21 ? "active" : ""}`} key={n}>
                  <small>{i}</small>
                  <strong>{n}</strong>
                </div>
              ))}
            </div>
            <p>
              <code>mid = 4</code> <ArrowRight size={16} />{" "}
              <strong>목표값 21을 찾았어요.</strong>
            </p>
            <div className="mini-code">
              while left &lt;= right:
              <br />
              　mid = (left + right) // 2<br />
              　if a[mid] == target:
              <br />
              　　return mid
            </div>
            <small>개념을 소개하는 예제입니다.</small>
          </div>
        </main>
      </>
    );
  const actualPage =
    mobile && ["workspace", "problems", "history"].includes(page)
      ? "home"
      : page;
  return (
    <>
      {header}
      <main>
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button className="text-button" onClick={() => setNotice("")}>
              닫기
            </button>
          </div>
        )}
        {actualPage === "home" && (
          <>
            <section className="hero">
              <div>
                <span className="eyebrow">LEARN BY UNDERSTANDING</span>
                <h1>
                  오늘은 어떤 흐름을
                  <br />
                  이해해 볼까요?
                </h1>
                <p>
                  자료구조를 살펴보고, 알고리즘의 다음 단계를 직접 따라가세요.
                </p>
                <button
                  onClick={() => {
                    const t = topics.find((t) => t.id === "binary-search");
                    setTopic(t);
                    setPage("lesson");
                  }}
                >
                  이진 탐색부터 시작하기 <ArrowRight size={18} />
                </button>
              </div>
              <div className="hero-diagram">
                <span className="badge">작은 단계가 만드는 이해</span>
                <div className="array">
                  {[2, 5, 8, 13, 21].map((v, i) => (
                    <div className={`cell ${i === 2 ? "active" : ""}`} key={v}>
                      <small>{i}</small>
                      <strong>{v}</strong>
                    </div>
                  ))}
                </div>
                <p>
                  관찰하고 <span>→</span> 예측하고 <span>→</span> 확인하세요
                </p>
              </div>
            </section>
            <div className="section-heading">
              <div>
                <span className="eyebrow">LEARNING PATH</span>
                <h2>개념별 학습</h2>
              </div>
              <label className="search">
                <Search size={18} />
                <input
                  placeholder="개념 검색"
                  aria-label="개념 검색"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </label>
            </div>
            <div className="topic-grid">
              {topics
                .filter((t) => (t.title + t.category).includes(filter))
                .map((t) => (
                  <button
                    className="topic-card"
                    key={t.id}
                    onClick={() => {
                      setTopic(t);
                      setPage("lesson");
                    }}
                  >
                    <div className="section-heading">
                      <span className="topic-symbol">
                        {t.category === "그래프" ? <GitBranch /> : <BookOpen />}
                      </span>
                      <span className="badge">
                        {t.priority} · {t.category}
                      </span>
                    </div>
                    <h3>{t.title}</h3>
                    <p>{t.body.split(". ")[0]}.</p>
                    <span className="card-link">
                      개념과 퀴즈 보기 <ArrowRight size={16} />
                    </span>
                  </button>
                ))}
            </div>
          </>
        )}
        {actualPage === "lesson" && topic && (
          <>
            <button className="text-button" onClick={() => setPage("home")}>
              <ArrowLeft size={16} /> 학습 목록
            </button>
            <div className="page-heading">
              <span className="badge">
                {topic.priority} · {topic.category}
              </span>
              <h1>{topic.title}</h1>
              <p>개념을 살펴본 뒤 퀴즈로 이해를 확인하세요.</p>
            </div>
            <div className="lesson-layout">
              <div>
                <article className="panel prose">
                  <h2>핵심 개념</h2>
                  {topic.body.split(". ").map((s: string, i: number) => (
                    <p key={i}>
                      {s}
                      {s.endsWith(".") ? "" : "."}
                    </p>
                  ))}
                </article>
                <LessonDiagram topic={topic.id} />
              </div>
              <QuizPanel key={topic.id} topic={topic} onError={fail} />
            </div>
          </>
        )}
        {actualPage === "problems" && (
          <>
            <div className="page-heading">
              <span className="eyebrow">CODE & EXPLORE</span>
              <h1>이제, 코드로 확인해요.</h1>
              <p>
                공개 테스트와 시각화로 풀이 과정을 이해하세요. 실행과 기본
                분석은 무료예요.
              </p>
            </div>
            <div className="problem-list">
              {problems.map((p) => (
                <article className="panel problem-row" key={p.id}>
                  <div>
                    <span className="badge">
                      P0 · {topics.find((t) => t.id === p.topic_id)?.title}
                    </span>
                    <h2>{p.title}</h2>
                    <p>{p.statement}</p>
                    <small>
                      공개 테스트 {p.tests.length}개 · Python / C++ / Java
                    </small>
                  </div>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const r = await post("/records", {
                          problemId: p.id,
                          language: "python",
                        });
                        await openRecord(r.id);
                      } catch (e) {
                        fail(e);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    문제 풀기 <ArrowRight size={18} />
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
        {actualPage === "workspace" && record && problem && (
          <>
            <div className="workspace-heading">
              <div>
                <span className="eyebrow">
                  WORKSPACE ·{" "}
                  {topics.find((t) => t.id === problem.topic_id)?.title}
                </span>
                <h1>{problem.title}</h1>
              </div>
              <div className="actions">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => void exportPdf()}
                >
                  <FileDown size={17} /> PDF
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => void exportPdf(true)}
                >
                  Drive에 저장
                </button>
              </div>
            </div>
            <div className="workspace">
              <section className="panel editor-panel">
                <div className="language-tabs">
                  {Object.entries(labels).map(([k, v]) => (
                    <button
                      key={k}
                      className={language === k ? "tab active" : "tab"}
                      onClick={() => editCode(source, k)}
                    >
                      {String(v)}
                    </button>
                  ))}
                </div>
                <div className="file-status">
                  <code>
                    {language === "python"
                      ? "main.py"
                      : language === "java"
                        ? "Main.java"
                        : "main.cpp"}
                  </code>
                  <span role="status">{saveStatus}</span>
                </div>
                <Suspense fallback={<p>코드 편집기를 준비하고 있어요.</p>}>
                  <Editor
                    height="410px"
                    language={language === "cpp" ? "cpp" : language}
                    value={source}
                    onChange={(s) => editCode(s ?? "")}
                    theme={theme === "dark" ? "vs-dark" : "light"}
                    options={{
                      fontSize: 14,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 4,
                      wordWrap: "on",
                      padding: { top: 16 },
                    }}
                  />
                </Suspense>
                <label className="input-label" htmlFor="stdin">
                  표준 입력 · 사용자 입력 실행용
                </label>
                <textarea
                  id="stdin"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={4}
                />
                <div className="actions">
                  <button
                    disabled={
                      busy ||
                      record.execution?.status === "RUNNING" ||
                      record.execution?.status === "QUEUED"
                    }
                    onClick={() => void run("judge")}
                  >
                    <Play size={16} /> 전체 테스트 실행
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => void run("custom")}
                  >
                    입력 실행
                  </button>
                </div>
                <p className="caption">
                  테스트별 10초 · 프로그램 메모리 512MiB · 단일 파일 · 기본
                  라이브러리
                </p>
                <button
                  className="text-button"
                  onClick={() => {
                    if (confirm("현재 작성 코드를 권장 코드로 바꿀까요?"))
                      editCode(problem.references_code[language]);
                  }}
                >
                  권장 코드 불러오기
                </button>
              </section>
              <div className="right-column">
                <div className="panel problem-description">
                  <h3>문제</h3>
                  <p>{problem.statement}</p>
                  <details>
                    <summary>입출력 조건과 공개 테스트</summary>
                    <p>{problem.input_spec}</p>
                    <p>{problem.output_spec}</p>
                    <small>{problem.constraints_text}</small>
                    {problem.tests.map((t: any, i: number) => (
                      <div className="public-test" key={i}>
                        <strong>테스트 {i + 1}</strong>
                        <pre>{t.input}</pre>
                        <code>예상 출력: {JSON.stringify(t.expected)}</code>
                      </div>
                    ))}
                  </details>
                </div>
                <section className="panel results">
                  <div className="language-tabs">
                    {[
                      ["visual", "시각화"],
                      ["tests", "테스트 결과"],
                      ["review", "코드 리뷰"],
                    ].map(([k, v]) => (
                      <button
                        key={k}
                        className={`tab ${tab === k ? "active" : ""}`}
                        onClick={() => setTab(k)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  {tab !== "review" && (
                    <>
                      <div className="execution-state">
                        <span className="badge">
                          {record.execution?.result?.verdict ??
                            record.execution?.status ??
                            "실행 전"}
                        </span>
                        {record.execution?.status === "QUEUED" && (
                          <p>
                            실행 환경을 기다리고 있어요. 대기 시간은 테스트
                            제한에 포함되지 않아요.
                          </p>
                        )}
                        {record.execution?.status === "RUNNING" && (
                          <p>격리된 환경에서 실행하고 있어요.</p>
                        )}
                        {record.execution?.status === "FAILED" && (
                          <div className="inline-error">
                            실행 시스템에 문제가 생겼어요. 코드 오답으로
                            판정하지 않습니다.
                            <button
                              className="secondary"
                              onClick={() => void run("judge")}
                            >
                              다시 실행
                            </button>
                          </div>
                        )}
                        {record.execution?.result?.diagnostics && (
                          <pre className="error-output">
                            {record.execution.result.diagnostics}
                          </pre>
                        )}
                      </div>
                      {record.execution?.result?.tests?.length > 0 && (
                        <select
                          aria-label="표시할 테스트"
                          value={testIndex}
                          onChange={(e) => setTestIndex(Number(e.target.value))}
                        >
                          {record.execution.result.tests.map(
                            (t: any, i: number) => (
                              <option key={i} value={i}>
                                테스트 {i + 1} · {t.verdict}
                              </option>
                            ),
                          )}
                        </select>
                      )}
                    </>
                  )}
                  {tab === "visual" && (
                    <>
                      <TraceViewer
                        trace={selectedTest?.trace ?? []}
                        topic={problem.topic_id}
                        truncated={selectedTest?.traceTruncated}
                      />
                      {record.execution?.result?.analysis && (
                        <div className="analysis">
                          <h3>시간 · 공간 복잡도</h3>
                          <div className="metrics">
                            <div>
                              <small>시간 복잡도</small>
                              <strong>
                                {record.execution.result.analysis.time ??
                                  "분석 미지원"}
                              </strong>
                            </div>
                            <div>
                              <small>공간 복잡도</small>
                              <strong>
                                {record.execution.result.analysis.space ??
                                  "분석 미지원"}
                              </strong>
                            </div>
                          </div>
                          <p className="caption">
                            {record.execution.result.analysis.evidence}
                            {record.execution.result.analysis.findings?.map(
                              (f: any, i: number) => (
                                <span key={i} style={{ display: "block" }}>
                                  {f.line}줄 · {f.message}
                                </span>
                              ),
                            )}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  {tab === "tests" &&
                    (selectedTest ? (
                      <>
                        <div className="metrics">
                          <div>
                            <small>실행 시간</small>
                            <strong>{selectedTest.elapsedMs} ms</strong>
                          </div>
                          <div>
                            <small>최대 메모리</small>
                            <strong>
                              {(
                                selectedTest.peakMemoryBytes /
                                1024 /
                                1024
                              ).toFixed(2)}{" "}
                              MiB
                            </strong>
                          </div>
                        </div>
                        <p className="caption">
                          엄격 비교 · 아래 표기는 공백과 줄바꿈을 포함해요.
                        </p>
                        {[
                          ["입력", selectedTest.input],
                          [
                            "예상 출력",
                            selectedTest.expected === null
                              ? "사용자 입력 실행 — 채점 없음"
                              : JSON.stringify(selectedTest.expected),
                          ],
                          ["실제 출력", JSON.stringify(selectedTest.actual)],
                          ["실행 오류", selectedTest.stderr || "없음"],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <h4>{k}</h4>
                            <pre>{v}</pre>
                          </div>
                        ))}
                      </>
                    ) : (
                      <p className="empty">
                        코드를 실행하면 테스트 결과가 여기에 표시돼요.
                      </p>
                    ))}
                  {tab === "review" && (
                    <>
                      <div className="section-heading">
                        <h3>코드 리뷰</h3>
                        <span className="badge">
                          무료{" "}
                          {Math.max(
                            0,
                            3 - (usage?.consumed ?? 0) - (usage?.reserved ?? 0),
                          )}{" "}
                          / 3건 남음
                        </span>
                      </div>
                      <p className="muted">
                        논리 오류 · 효율 개선 · 대안 코드를 확인해요.
                        <br />
                        작성 코드, 권장 코드, 문제를 LLM에 전달합니다.
                      </p>
                      <button
                        disabled={busy || !config?.reviewEnabled}
                        onClick={() => void review()}
                      >
                        현재 코드 리뷰 요청
                      </button>
                      {!config?.reviewEnabled && (
                        <p className="caption">
                          리뷰 서비스 연결이 준비 중이에요. 이용량은 차감되지
                          않아요.
                        </p>
                      )}
                      <p className="caption">
                        KST 매월 1일 초기화 · 이월 없음 · 추가 구매는 가격 확정
                        후 제공
                      </p>
                      {record.reviews?.map((r: any) => (
                        <article className="review" key={r.id}>
                          <span className="badge">{r.status}</span>
                          <small>
                            {new Date(r.created_at).toLocaleString("ko-KR")}
                          </small>
                          {r.status === "FAILED" && (
                            <p>
                              리뷰를 완료하지 못했어요. 이용량은 차감되지
                              않았어요.
                            </p>
                          )}
                          {r.result && (
                            <>
                              <h4>논리 오류</h4>
                              <p className="pre-wrap">
                                {r.result.logicalErrors}
                              </p>
                              <h4>효율 개선</h4>
                              <p className="pre-wrap">
                                {r.result.efficiencyImprovements}
                              </p>
                              <h4>대안 코드</h4>
                              <pre>{r.result.alternativeCode}</pre>
                            </>
                          )}
                          <details>
                            <summary>
                              리뷰 당시 코드 · {labels[r.language]}
                            </summary>
                            <pre>{r.source}</pre>
                          </details>
                        </article>
                      ))}
                    </>
                  )}
                </section>
              </div>
            </div>
          </>
        )}
        {actualPage === "history" && (
          <>
            <div className="page-heading">
              <span className="eyebrow">YOUR LEARNING JOURNEY</span>
              <h1>내 기록</h1>
              <p>
                최대 100건 · 생성일로부터 30일 보관 · 재실행은 같은 기록에
                저장돼요.
              </p>
            </div>
            {records.length === 0 ? (
              <section className="panel empty">
                <BookOpen size={32} />
                <h2>첫 번째 풀이를 남겨보세요.</h2>
                <button onClick={() => setPage("problems")}>
                  문제 둘러보기
                </button>
              </section>
            ) : (
              records.map((r) => (
                <article className="panel history-row" key={r.id}>
                  <div>
                    <span className="badge">{labels[r.language]}</span>
                    <h3>{r.title}</h3>
                    <small>
                      {new Date(r.updated_at).toLocaleString("ko-KR")} ·{" "}
                      {new Date(r.expires_at).toLocaleDateString("ko-KR")} 만료
                    </small>
                  </div>
                  <div className="actions">
                    <button
                      className="secondary"
                      onClick={() => void openRecord(r.id).catch(fail)}
                    >
                      이어서 보기
                    </button>
                    <button
                      className="text-button danger"
                      onClick={async () => {
                        if (
                          !confirm(
                            "기록과 코드·리뷰를 삭제할까요? 복구할 수 없고 리뷰 이용량은 반환되지 않아요.",
                          )
                        )
                          return;
                        try {
                          await api(`/records/${r.id}`, { method: "DELETE" });
                          if (recordRef.current?.id === r.id) {
                            recordRef.current = null;
                            setRecord(null);
                          }
                          await loadData();
                        } catch (e) {
                          fail(e);
                        }
                      }}
                    >
                      삭제
                    </button>
                  </div>
                </article>
              ))
            )}
          </>
        )}
      </main>
      <footer>
        알고리즘 <span>이해가 쌓이는 학습 공간</span>
        <small>Python 3.10 · C++20 · Java 21</small>
      </footer>
    </>
  );
}
class AppBoundary extends React.Component<
  React.PropsWithChildren,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="system-error">
        <img src="/logo.svg" width="150" alt="Algostep" />
        <h1>화면을 표시하지 못했어요</h1>
        <p>
          화면을 다시 열어 주세요. 마지막 자동 저장 이후의 변경은 복구되지 않을
          수 있어요.
        </p>
        <button onClick={() => location.reload()}>화면 다시 열기</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <AppBoundary>
    <App />
  </AppBoundary>,
);
