import { track } from "./analytics.js";
import { DiagramCanvas, graphPositions } from "./DiagramCanvas.js";
import { lessonExamples } from "./lesson-examples.js";
import React, { useEffect, useState } from "react";
import { ObjectGraph } from "./ObjectGraph.js";
import { lessonFrames } from "./lesson-model.js";
import { advancedTopics } from "./advanced-lessons.js";
import { AdvancedLesson } from "./AdvancedLesson.js";
export function TraceViewer({
  trace,
  topic,
  truncated = false,
}: {
  trace: any[];
  topic: string;
  truncated?: boolean;
}) {
  const [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false);
  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [trace]);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(
      () =>
        setStep((s) => {
          if (s >= trace.length - 1) {
            setPlaying(false);
            return s;
          }
          return s + 1;
        }),
      650,
    );
    return () => clearInterval(t);
  }, [playing, trace]);
  const current = trace[step],
    vars = current?.locals ?? {};
  return (
    <div className="trace">
      <div className="section-heading">
        <h3>실행 시각화</h3>
        <span className="badge">
          {current ? `${step + 1} / ${trace.length} 단계` : "실행 데이터 없음"}
        </span>
      </div>
      {!current ? (
        <p className="muted">
          이 실행에는 수집된 추적 데이터가 없어요. 테스트 결과와 출력으로 확인해
          주세요.
        </p>
      ) : (
        <>
          <p className="muted">
            {current.line}번째 줄 ·{" "}
            {current.event === "line" ? "이 줄을 실행하기 직전" : current.event}{" "}
            {truncated && "· 수집 한도에 도달했어요"}
          </p>
          <Structure vars={vars} topic={topic} />
          <ObjectGraph vars={vars} />
          <p className="caption">
            시각화는 같은 입력으로 별도 실행한 추적이에요. 난수·현재 시각에
            의존하는 코드는 채점 실행과 흐름이 다를 수 있어요.
          </p>
          <div className="playback">
            <button
              className="secondary"
              aria-label="이전 단계"
              onClick={() => {
                setPlaying(false);
                track("VISUALIZATION_CONTROL", { action: "previous", step });
                setStep(Math.max(0, step - 1));
              }}
            >
              이전
            </button>
            <button
              onClick={() => {
                track("VISUALIZATION_CONTROL", {
                  action: playing ? "pause" : "play",
                  step,
                });
                setPlaying(!playing);
              }}
            >
              {playing ? "일시 정지" : "재생"}
            </button>
            <button
              className="secondary"
              aria-label="다음 단계"
              onClick={() => {
                setPlaying(false);
                track("VISUALIZATION_CONTROL", { action: "next", step });
                setStep(Math.min(trace.length - 1, step + 1));
              }}
            >
              다음
            </button>
            <input
              aria-label="실행 단계"
              onPointerUp={() =>
                track("VISUALIZATION_CONTROL", { action: "seek", step })
              }
              onKeyUp={() =>
                track("VISUALIZATION_CONTROL", { action: "seek", step })
              }
              type="range"
              min="0"
              max={Math.max(0, trace.length - 1)}
              value={step}
              onChange={(e) => {
                setPlaying(false);
                setStep(Number(e.target.value));
              }}
            />
          </div>
          <details open>
            <summary>변수 · 호출 스택</summary>
            <div className="variables">
              {Object.entries(vars)
                .filter(([k]) => !["__builtins__"].includes(k))
                .map(([k, v]) => (
                  <div key={k}>
                    <code>{k}</code>
                    <code>{JSON.stringify(v)}</code>
                  </div>
                ))}
            </div>
            <p className="muted">{current.stack?.join(" ← ")}</p>
          </details>
        </>
      )}
    </div>
  );
}
export function Structure({ vars, topic }: { vars: any; topic: string }) {
  const matrix = topic === "graph-matrix" ? vars.matrix : vars.buckets;
  if (Array.isArray(matrix))
    return (
      <div style={{ overflowX: "auto" }}>
        <table>
          <caption>
            {topic === "graph-matrix" ? "인접 행렬" : "해시 버킷과 체인"}
          </caption>
          <tbody>
            {matrix.map((row: any[], i: number) => (
              <tr key={i}>
                <th>{i}</th>
                {row.map((v, j) => (
                  <td key={j} style={{ padding: "8px" }}>
                    {String(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  const entries = Object.entries(vars);
  const arrays = entries.filter(([, v]) => Array.isArray(v));
  const adjacency = arrays.filter(
    ([, v]: any) =>
      v.length > 0 &&
      v.every(
        (r: any) =>
          Array.isArray(r) &&
          r.every((n: any) => Number.isInteger(n) && n >= 0 && n < v.length),
      ),
  );
  const flat = arrays.filter(([, v]: any) =>
    v.every((x: any) => typeof x === "number" || typeof x === "string"),
  );
  // Only choose an unambiguous shape; the topic supplies semantics, not a variable name.
  if (["bfs", "dfs", "graph-list"].includes(topic) && adjacency.length === 1)
    vars = { ...vars, graph: adjacency[0][1] };
  if (flat.length === 1 && !vars.values && !vars.a)
    vars = { ...vars, values: flat[0][1] };
  // Recognized names from the curated examples; arbitrary names remain in the variable view.
  vars = {
    ...vars,
    graph: vars.graph ?? vars.g,
    visited: vars.visited ?? vars.seen,
    queue: vars.queue ?? vars.q,
    values: vars.values ?? vars.a,
    index: vars.index ?? vars.i,
    current: vars.current ?? vars.v,
  };
  if (
    ["bfs", "dfs", "graph-list"].includes(topic) &&
    Array.isArray(vars.graph) &&
    vars.graph.every((v: any) => Array.isArray(v))
  ) {
    const n = vars.graph.length;
    if (n > 20) return <p>정점이 많아 변수 보기로 표시해요.</p>;
    const positions = graphPositions(vars.graph);
    const edges = vars.graph.flatMap((neighbors: number[], i: number) =>
      [...new Set(neighbors)]
        .filter(
          (j) =>
            Number.isInteger(j) &&
            j >= 0 &&
            j < n &&
            (j >= i || !vars.graph[j].includes(i)),
        )
        .map((j) => ({
          from: String(i),
          to: String(j),
          directed: !vars.graph[j].includes(i),
        })),
    );
    return (
      <>
        <DiagramCanvas
          key={topic}
          label="그래프의 현재 방문 상태"
          nodes={positions.map((p, i) => ({
            id: String(i),
            ...p,
            label: String(i),
            state:
              vars.current === i
                ? "active"
                : vars.visited?.[i]
                  ? "visited"
                  : "",
          }))}
          edges={edges}
        />
        <p>
          {topic === "dfs" ? "스택" : "큐"}{" "}
          <code>{JSON.stringify(vars.queue ?? [])}</code> · 방문 순서{" "}
          <code>{JSON.stringify(vars.order ?? [])}</code>
        </p>
      </>
    );
  }
  if ((topic === "tree" || topic === "heap") && Array.isArray(vars.values)) {
    const values = vars.values.slice(0, 31),
      levels = Math.max(1, Math.ceil(Math.log2(values.length + 1))),
      width = Math.max(560, 2 ** (levels - 1) * 100);
    const nodes = values.map((v: any, i: number) => {
      const level = Math.floor(Math.log2(i + 1)),
        first = 2 ** level - 1;
      return {
        id: String(i),
        x: (width * (i - first + 0.5)) / 2 ** level,
        y: 65 + level * 110,
        label: String(v),
        detail: `인덱스 ${i}`,
        state: vars.index === i || vars.mid === i ? "active" : "",
      };
    });
    return (
      <>
        <DiagramCanvas
          key={topic}
          label="이진 트리와 현재 노드"
          nodes={nodes}
          edges={nodes.slice(1).map((node: any, i: number) => ({
            from: String(Math.floor(i / 2)),
            to: node.id,
          }))}
        />
        <p>
          {topic === "tree" ? "중위 순회" : "힙 배열"}{" "}
          <code>{JSON.stringify(vars.order ?? (topic === "tree" ? [] : values))}</code>
        </p>
        {vars.values.length > 31 && (
          <p>처음 31개 노드를 표시해요. 전체 값은 변수 보기에서 확인하세요.</p>
        )}
      </>
    );
  }
  const a = Array.isArray(vars.a)
    ? vars.a
    : Array.isArray(vars.values)
      ? vars.values
      : Array.isArray(vars.order)
        ? vars.order
        : null;
  if (a?.length === 0 && Object.values(vars).some((v: any) => v?.$id))
    return null;
  if (a)
    return (
      <div className="array-board">
        <DiagramCanvas
          key={topic}
          label="배열 인덱스와 포인터"
          nodes={a.slice(0, 30).map((v: any, i: number) => ({
            id: String(i),
            x: 75 + (i % 6) * 120,
            y: 65 + Math.floor(i / 6) * 110,
            label: typeof v === "object" ? JSON.stringify(v) : String(v),
            detail: `[${i}] ${i === vars.left ? "L " : ""}${i === vars.right ? "R " : ""}${i === vars.mid ? "mid" : ""}`,
            shape: "card" as const,
            width: 100,
            height: 68,
            state:
              i === vars.mid ? "active" : i === vars.answer ? "visited" : "",
          }))}
        />
        {a.length === 0 && <p>비어 있는 구조예요.</p>}
        {a.length > 30 && (
          <p>처음 30개 원소를 표시해요. 전체 값은 변수 보기에서 확인하세요.</p>
        )}
      </div>
    );
  return (
    <p className="muted">
      구조를 자동으로 식별할 수 없는 단계예요. 아래 변수와 호출 스택을
      확인하세요.
    </p>
  );
}
export function LessonDiagram({ topic }: { topic: string }) {
  return (advancedTopics as readonly string[]).includes(topic) ? (
    <AdvancedLesson key={topic} topic={topic} />
  ) : (
    <CoreLessonDiagram key={topic} topic={topic} />
  );
}
function CoreLessonDiagram({ topic }: { topic: string }) {
  const examples = lessonExamples(topic);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [text, setText] = useState("2, 5, 8, 13, 21, 34, 55");
  const [target, setTarget] = useState(21);
  const [values, setValues] = useState([2, 5, 8, 13, 21, 34, 55]);
  const [invalid, setInvalid] = useState("");
  const [custom, setCustom] = useState(false);
  const computed = lessonFrames(
    topic,
    values,
    target,
    custom ? undefined : examples[exampleIndex]?.graph,
  );
  const frames = computed;
  useEffect(() => {
    const first = lessonExamples(topic)[0];
    setStep(0);
    setExampleIndex(0);
    setText(first.values.join(", "));
    setValues(first.values);
    setTarget(first.target);
    setInvalid("");
    setCustom(false);
  }, [topic]);
  if (!frames.length) return null;
  const current = frames[Math.min(step, frames.length - 1)];
  return (
    <section className="panel">
      <div className="section-heading">
        <h3>개념을 한 단계씩</h3>
        <span className="badge">설명용 예제</span>
      </div>
      <div className="example-picker">
        <label>
          예제 선택{" "}
          <select
            aria-label="예제 선택"
            value={exampleIndex}
            onChange={(e) => {
              const i = Number(e.target.value),
                example = examples[i];
              track("EXAMPLE_SELECTED", { topic, index: i });
              setExampleIndex(i);
              setCustom(false);
              setText(example.values.join(", "));
              setValues(example.values);
              setTarget(example.target);
              setStep(0);
              setInvalid("");
            }}
          >
            {examples.map((ex, i) => (
              <option key={i} value={i}>
                {i + 1}. {ex.title}
              </option>
            ))}
          </select>
        </label>
        <p>{examples[exampleIndex]?.description}</p>
      </div>
      <form
        className="lesson-controls"
        onSubmit={(e) => {
          e.preventDefault();
          const nums = text
            .split(/[,\s]+/)
            .filter(Boolean)
            .map(Number);
          if (
            !nums.length ||
            nums.length > 8 ||
            nums.some((n) => !Number.isInteger(n) || Math.abs(n) > 1000)
          ) {
            track("EXAMPLE_APPLIED", {
              topic,
              count: Math.min(nums.length, 1000000),
              success: false,
            });
            setInvalid("정수 1~8개를 입력하세요. 각 값은 -1000~1000이에요.");
            return;
          }
          track("EXAMPLE_APPLIED", {
            topic,
            count: nums.length,
            success: true,
          });
          setValues(nums);
          setCustom(true);
          setStep(0);
          setInvalid("");
        }}
      >
        <label>
          예제 값{" "}
          <input
            aria-label="예제 값"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        {[
          "binary-search",
          "linear-search",
          "two-pointer",
          "greedy",
          "recursion",
          "dp",
          "memoization",
          "tabulation",
        ].includes(topic) && (
          <label>
            {["recursion", "dp", "memoization", "tabulation"].includes(topic)
              ? "계산할 크기"
              : "목표 값"}{" "}
            <input
              aria-label="예제 목표"
              type="number"
              min="0"
              max="1000"
              value={target}
              onChange={(e) => {
                setTarget(
                  Math.min(1000, Math.max(0, Number(e.target.value) || 0)),
                );
                setStep(0);
              }}
            />
          </label>
        )}
        <button className="secondary" type="submit">
          예제 적용 · 처음부터
        </button>
        {invalid && <p role="alert">{invalid}</p>}
      </form>
      <p>{current.note}</p>
      <Structure
        key={"structure-" + topic + exampleIndex}
        topic={topic}
        vars={current.vars}
      />
      <ObjectGraph
        key={"objects-" + topic + exampleIndex}
        vars={current.vars}
        educational
      />
      {current.vars.stack && (
        <p>호출 스택: {current.vars.stack.join(" → ") || "비어 있음"}</p>
      )}
      <p className="caption">
        설명용 예제이며 제출 코드의 실행 결과와는 달라요.
        {["bfs", "dfs", "graph-list", "graph-matrix"].includes(topic) &&
          (custom
            ? " 입력 값으로 예제 간선을 구성해요."
            : " 선택한 예제의 간선을 사용해요.")}
        {topic === "recursion" &&
          " 호출이 길어지지 않도록 크기는 최대 6을 사용해요."}
        {["dp", "memoization", "tabulation"].includes(topic) &&
          " 피보나치 수를 최대 12까지 계산해요."}
        {topic === "backtracking" && " 처음 5개 원소의 부분집합을 탐색해요."}
      </p>
      <div className="playback">
        <button
          className="secondary"
          disabled={step === 0}
          onClick={() => {
            track("VISUALIZATION_CONTROL", { action: "previous", step });
            setStep(step - 1);
          }}
        >
          이전
        </button>
        <span>
          {Math.min(step + 1, frames.length)} / {frames.length}
        </span>
        <button
          disabled={step >= frames.length - 1}
          onClick={() => {
            track("VISUALIZATION_CONTROL", { action: "next", step });
            setStep(step + 1);
          }}
        >
          다음 단계
        </button>
      </div>
    </section>
  );
}
