import React, { useEffect, useState } from "react";
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
                setStep(Math.max(0, step - 1));
              }}
            >
              이전
            </button>
            <button onClick={() => setPlaying(!playing)}>
              {playing ? "일시 정지" : "재생"}
            </button>
            <button
              className="secondary"
              aria-label="다음 단계"
              onClick={() => {
                setPlaying(false);
                setStep(Math.min(trace.length - 1, step + 1));
              }}
            >
              다음
            </button>
            <input
              aria-label="실행 단계"
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
function Structure({ vars, topic }: { vars: any; topic: string }) {
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
    topic === "bfs" &&
    Array.isArray(vars.graph) &&
    vars.graph.every((v: any) => Array.isArray(v))
  ) {
    const n = vars.graph.length;
    if (n > 20) return <p>정점이 많아 변수 보기로 표시해요.</p>;
    const positions = Array.from({ length: n }, (_, i) => ({
      x: 250 + 170 * Math.cos((2 * Math.PI * i) / n - Math.PI / 2),
      y: 140 + 100 * Math.sin((2 * Math.PI * i) / n - Math.PI / 2),
    }));
    return (
      <>
        <svg
          viewBox="0 0 500 280"
          role="img"
          aria-label="그래프의 현재 방문 상태"
        >
          {vars.graph.flatMap((neighbors: any[], i: number) =>
            neighbors
              .filter((j) => Number.isInteger(j) && j >= 0 && j < n && j > i)
              .map((j) => (
                <line
                  key={`${i}-${j}`}
                  x1={positions[i].x}
                  y1={positions[i].y}
                  x2={positions[j].x}
                  y2={positions[j].y}
                  className="edge"
                />
              )),
          )}
          {positions.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r="22"
                className={
                  vars.current === i
                    ? "node active"
                    : vars.visited?.[i]
                      ? "node visited"
                      : "node"
                }
              />
              <text x={p.x} y={p.y + 5} textAnchor="middle">
                {i}
              </text>
            </g>
          ))}
        </svg>
        <p>
          큐 <code>{JSON.stringify(vars.queue ?? [])}</code> · 방문 순서{" "}
          <code>{JSON.stringify(vars.order ?? [])}</code>
        </p>
      </>
    );
  }
  if (topic === "tree" && Array.isArray(vars.values)) {
    const values = vars.values.slice(0, 15);
    const pos = values.map((_: any, i: number) => {
      const level = Math.floor(Math.log2(i + 1)),
        first = 2 ** level - 1;
      return { x: (500 * (i - first + 0.5)) / 2 ** level, y: 35 + level * 60 };
    });
    return (
      <>
        <svg
          viewBox="0 0 500 250"
          role="img"
          aria-label="이진 트리와 현재 노드"
        >
          {pos.slice(1).map((p: any, i: number) => {
            const parent = pos[Math.floor(i / 2)];
            return (
              <line
                key={i}
                x1={parent.x}
                y1={parent.y}
                x2={p.x}
                y2={p.y}
                className="edge"
              />
            );
          })}
          {values.map((v: any, i: number) => (
            <g key={i}>
              <circle
                cx={pos[i].x}
                cy={pos[i].y}
                r="21"
                className={
                  vars.index === i
                    ? "node active"
                    : vars.order?.includes(v)
                      ? "node visited"
                      : "node"
                }
              />
              <text x={pos[i].x} y={pos[i].y + 5} textAnchor="middle">
                {String(v)}
              </text>
            </g>
          ))}
        </svg>
        <p>
          중위 순회 <code>{JSON.stringify(vars.order ?? [])}</code>
        </p>
      </>
    );
  }
  const a = Array.isArray(vars.a)
    ? vars.a
    : Array.isArray(vars.order)
      ? vars.order
      : null;
  if (a)
    return (
      <div className="array">
        {a.slice(0, 30).map((v: any, i: number) => (
          <div
            key={i}
            className={`cell ${i === vars.mid ? "active" : ""} ${i === vars.answer ? "visited" : ""}`}
          >
            <small>{i}</small>
            <strong>
              {typeof v === "object" ? JSON.stringify(v) : String(v)}
            </strong>
            {i === vars.left && <em>L</em>}
            {i === vars.right && <em>R</em>}
          </div>
        ))}
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
  const presets: any = {
    "binary-search": [
      { a: [2, 5, 8, 13, 21, 34, 55], left: 0, right: 6, mid: 3 },
      { a: [2, 5, 8, 13, 21, 34, 55], left: 4, right: 6, mid: 5 },
      { a: [2, 5, 8, 13, 21, 34, 55], left: 4, right: 4, mid: 4, answer: 4 },
    ],
    bfs: [
      {
        graph: [[1, 2], [0, 3, 4], [0, 4], [1], [1, 2, 5], [4]],
        current: 0,
        visited: [true, false, false, false, false, false],
        queue: [0],
        order: [],
      },
      {
        graph: [[1, 2], [0, 3, 4], [0, 4], [1], [1, 2, 5], [4]],
        current: 1,
        visited: [true, true, true, true, true, false],
        queue: [2, 3, 4],
        order: [0, 1],
      },
      {
        graph: [[1, 2], [0, 3, 4], [0, 4], [1], [1, 2, 5], [4]],
        current: 2,
        visited: [true, true, true, true, true, false],
        queue: [3, 4],
        order: [0, 1, 2],
      },
    ],
    tree: [
      { values: [8, 4, 12, 2, 6, 10, 14], index: 3, order: [2] },
      { values: [8, 4, 12, 2, 6, 10, 14], index: 1, order: [2, 4] },
      { values: [8, 4, 12, 2, 6, 10, 14], index: 4, order: [2, 4, 6] },
    ],
  };
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [topic]);
  if (!presets[topic]) return null;
  return (
    <section className="panel">
      <div className="section-heading">
        <h3>개념을 한 단계씩</h3>
        <span className="badge">설명용 예제</span>
      </div>
      <Structure topic={topic} vars={presets[topic][step]} />
      <div className="playback">
        <button
          className="secondary"
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
        >
          이전
        </button>
        <span>
          {step + 1} / {presets[topic].length}
        </span>
        <button
          disabled={step === presets[topic].length - 1}
          onClick={() => setStep(step + 1)}
        >
          다음 단계
        </button>
      </div>
    </section>
  );
}
