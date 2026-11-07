import React, { useEffect, useMemo, useState } from "react";
import {
  checkpoints,
  matchesAnswer,
  type LearningFrame,
} from "./prediction-model.js";
import { Structure } from "./visualization.js";
import { ObjectGraph } from "./ObjectGraph.js";
import {
  DiagramCanvas,
  graphPositions,
  type DiagramNode,
  type DiagramEdge,
} from "./DiagramCanvas.js";
import { go } from "./router.js";
import { track } from "./analytics.js";

export function LearningSteps({
  topic,
  stage,
  mobile,
}: {
  topic: string;
  stage: number;
  mobile: boolean;
}) {
  return (
    <nav className="learning-steps" aria-label="학습 단계">
      {[
        "01 개념 이해",
        "02 다음 상태 예측",
        ...(!mobile ? ["03 코드 작성"] : []),
      ].map((label, i) => (
        <a
          key={label}
          href={`/learn/${topic}/${["concept", "predict/1", "code"][i]}`}
          aria-current={stage === i ? "step" : undefined}
          onClick={(e) => {
            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
              e.preventDefault();
              go(e.currentTarget.getAttribute("href")!);
            }
          }}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
export function ExampleAnimation({
  topic,
  title,
  theme,
}: {
  topic: string;
  title: string;
  theme: string;
}) {
  const [playing, setPlaying] = useState(
    () => !matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [version, setVersion] = useState(0);
  const mode = theme === "dark" ? "dark" : "light";
  return (
    <section className="panel example-animation">
      <h2>움직임으로 살펴보기</h2>
      <p>예시 입력에서 상태가 바뀌는 과정을 살펴보세요.</p>
      <img
        key={`${topic}-${mode}-${version}-${playing}`}
        src={`/learning/${topic}-${mode}.${playing ? "gif" : "png"}`}
        alt={`${title} 예시 동작${playing ? " 애니메이션" : " 첫 장면"}`}
        width="960"
        height="600"
      />
      <div className="actions">
        <button
          className="secondary"
          onClick={() => {
            track("VISUALIZATION_CONTROL", {
              action: playing ? "pause" : "play",
            });
            setPlaying(!playing);
          }}
        >
          {playing ? "자동 재생 끄기" : "GIF 재생"}
        </button>
        <button
          className="secondary"
          onClick={() => {
            setVersion((v) => v + 1);
            setPlaying(true);
          }}
        >
          처음부터 보기
        </button>
      </div>
      <p className="caption">
        자동 재생을 끄면 첫 장면을 표시해요. 아래 단계별 예제에서 각 상태를
        자세히 확인할 수 있어요.
      </p>
    </section>
  );
}
function StateDiagram({
  frame,
  topic,
}: {
  frame: LearningFrame;
  topic: string;
}) {
  return frame.advanced ? (
    <>
      <DiagramCanvas
        nodes={frame.advanced.nodes}
        edges={frame.advanced.edges}
        label="학습 알고리즘 상태"
        responsiveFit
      />
      <div className="state-table">
        <table>
          <tbody>
            {frame.advanced.rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  ) : (
    <>
      <Structure vars={frame.core!.vars} topic={topic} />
      <ObjectGraph vars={frame.core!.vars} educational />
      <dl className="state-values">
        {Object.entries(frame.core!.vars)
          .filter(
            ([k, v]) =>
              ![
                "a",
                "graph",
                "matrix",
                "values",
                "head",
                "root",
                "buckets",
              ].includes(k) &&
              (!v || typeof v !== "object" || Array.isArray(v)),
          )
          .map(([k, v]) => (
            <React.Fragment key={k}>
              <dt>{k}</dt>
              <dd>{JSON.stringify(v)}</dd>
            </React.Fragment>
          ))}
      </dl>
    </>
  );
}
export function Prediction({
  topic,
  step,
  userId,
  mobile,
}: {
  topic: any;
  step: number;
  userId: string;
  mobile: boolean;
}) {
  const questions = useMemo(() => checkpoints(topic.id), [topic.id]);
  const q = questions[step - 1];
  const storageKey = `prediction-v1:${userId}:${topic.id}:${step}`;
  const [state, setState] = useState<{
    answer: string;
    result: "correct" | "wrong" | null;
  }>(() => {
    try {
      return (
        JSON.parse(sessionStorage.getItem(storageKey) ?? "null") ?? {
          answer: "",
          result: null,
        }
      );
    } catch {
      return { answer: "", result: null };
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {}
  }, [state, storageKey]);
  useEffect(() => {
    track("QUIZ_VIEWED", { topic: topic.id, index: step - 1 });
  }, [topic.id, step]);
  if (!q)
    return (
      <section className="panel">
        <h1>존재하지 않는 학습 단계예요</h1>
        <button onClick={() => go(`/learn/${topic.id}/predict/1`, true)}>
          첫 단계로
        </button>
      </section>
    );
  const label = q.next.advanced
    ? q.field === "active"
      ? "강조할 노드 ID 목록 (ID 오름차순)"
      : `계산 표 ${Number(q.field.split(".")[1]) + 1}행`
    : ({
        a: "배열 / 자료구조의 값",
        current: "다음 방문 정점",
        index: "다음 방문 노드의 인덱스",
        mid: "다음 비교 인덱스",
        answer: "반환할 인덱스",
        order: "방문 순서",
        queue: "대기열",
        stack: "호출 스택",
      }[q.field] ?? q.field);
  const change = (answer: string) => setState({ answer, result: null });
  let answerNodes: DiagramNode[] = [],
    answerEdges: DiagramEdge[] = [];
  const vars = q.current.core?.vars ?? {};
  if (q.field === "current" && vars.graph) {
    answerNodes = graphPositions(vars.graph).map((p, i) => ({
      ...p,
      id: String(i),
      label: String(i),
      shape: "circle",
      state: state.answer === String(i) ? "active" : "",
    }));
    answerEdges = vars.graph.flatMap((row: number[], i: number) =>
      row.filter((j) => i < j).map((j) => ({ from: String(i), to: String(j) })),
    );
  } else if (topic.id === "tree" && q.choices) {
    answerNodes = q.choices.map((c, i) => {
      const depth = Math.floor(Math.log2(i + 1));
      return {
        id: String(i),
        label: c.label.split(" · ")[0],
        x: 80 + ((i - (2 ** depth - 1) + 0.5) * 600) / 2 ** depth,
        y: 60 + depth * 100,
        shape: "circle",
        state: state.answer === String(i) ? "active" : "",
      };
    });
    answerEdges = answerNodes
      .slice(1)
      .map((n) => ({
        from: String(Math.floor((Number(n.id) - 1) / 2)),
        to: n.id,
      }));
  }
  const correct =
    state.result === "correct" && matchesAnswer(state.answer, q.answer);
  return (
    <>
      <div className="page-heading">
        <h1>{topic.title} · 다음 상태를 예측해요</h1>
        <p>현재 상태를 관찰하고 다음 단계의 값을 직접 구성하세요.</p>
      </div>
      <div className="prediction-layout">
        <section className="panel">
          <h2>
            현재 상태 · {step} / {questions.length}
          </h2>
          <p>{q.current.note}</p>
          <StateDiagram frame={q.current} topic={topic.id} />
          <p className="caption">다음 단계에서 바뀔 {label}을 예측해 보세요.</p>
        </section>
        <section className="panel">
          <h2>내가 만드는 다음 상태</h2>
          <p>{label}은 어떻게 될까요?</p>
          {q.field === "active" && (
            <p className="caption">
              {q.current.advanced?.nodes
                .map((n) => `${n.id} = ${n.label}`)
                .join(" / ")}
            </p>
          )}
          {answerNodes.length > 0 ? (
            <DiagramCanvas
              label="다음 상태 선택"
              nodes={answerNodes}
              edges={answerEdges}
              responsiveFit
              onSelect={change}
            />
          ) : q.choices ? (
            <div className="answer-targets" role="group" aria-label={label}>
              {q.choices.map((c) => (
                <button
                  key={c.value}
                  className={
                    state.answer === String(c.value) ? "" : "secondary"
                  }
                  aria-pressed={state.answer === String(c.value)}
                  onClick={() => change(String(c.value))}
                >
                  {c.label}
                </button>
              ))}
            </div>
          ) : (
            <label className="prediction-input">
              {label}
              <input
                aria-label="다음 상태의 값"
                value={state.answer}
                onChange={(e) => change(e.target.value)}
                placeholder={
                  Array.isArray(q.answer)
                    ? "순서대로 쉼표로 구분 (빈 배열은 [])"
                    : "다음 값을 입력하세요"
                }
              />
              <span className="caption">
                {Array.isArray(q.answer)
                  ? "표의 한 행 또는 배열 전체를 순서대로 입력해요. 예: 1, 2, 3"
                  : "숫자 또는 상태 값을 입력해요."}
              </span>
            </label>
          )}
          <p className="caption">
            내 답: {state.answer || "아직 선택하지 않았어요."}
          </p>
          <div
            className={`prediction-feedback ${correct ? "correct" : state.result === "wrong" ? "wrong" : ""}`}
            role="status"
          >
            <strong>
              {correct
                ? "정답이에요!"
                : state.result === "wrong"
                  ? "다시 생각해 보세요."
                  : "선택한 상태를 확인해 보세요."}
            </strong>
            <p>
              {correct
                ? q.next.note
                : state.result === "wrong"
                  ? "현재 값과 알고리즘의 처리 순서를 확인하고 답을 수정하세요."
                  : "정답 확인 전에는 다음 상태와 해설을 공개하지 않아요."}
            </p>
          </div>
          <button
            disabled={!state.answer.trim() || correct}
            onClick={() => {
              const success = matchesAnswer(state.answer, q.answer);
              setState({ ...state, result: success ? "correct" : "wrong" });
              track("PREDICTION_CHECKED", {
                topic: topic.id,
                index: step - 1,
                correct: success,
              });
            }}
          >
            정답 확인
          </button>
          {correct && (
            <details>
              <summary>다음 상태 확인</summary>
              <StateDiagram frame={q.next} topic={topic.id} />
            </details>
          )}
        </section>
      </div>
      <div className="playback">
        <button
          className="secondary"
          disabled={step === 1}
          onClick={() => go(`/learn/${topic.id}/predict/${step - 1}`)}
        >
          이전 단계
        </button>
        <button
          disabled={!correct || step === questions.length}
          onClick={() => go(`/learn/${topic.id}/predict/${step + 1}`)}
        >
          다음 단계
        </button>
      </div>
      <div className="lesson-next-screen">
        <button
          className="secondary"
          onClick={() => go(`/learn/${topic.id}/concept`)}
        >
          개념 설명으로
        </button>
        {step === questions.length &&
          correct &&
          (mobile ? (
            <button onClick={() => go("/learn")}>학습 완료 · 목록으로</button>
          ) : (
            <button onClick={() => go(`/learn/${topic.id}/code`)}>
              코드 작성으로
            </button>
          ))}
      </div>
    </>
  );
}
