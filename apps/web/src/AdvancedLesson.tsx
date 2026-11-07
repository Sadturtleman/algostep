import React, { useMemo, useState } from "react";
import { advancedLesson } from "./advanced-lessons.js";
import { DiagramCanvas } from "./DiagramCanvas.js";

export function AdvancedLesson({ topic }: { topic: string }) {
  const [variant, setVariant] = useState(0),
    [step, setStep] = useState(0);
  const examples = useMemo(
    () => [0, 1, 2].map((v) => advancedLesson(topic, v)),
    [topic],
  );
  const lesson = examples[variant],
    frame = lesson.frames[Math.min(step, lesson.frames.length - 1)];
  if (!frame) return null;
  return (
    <section className="panel advanced-lesson">
      <div className="section-heading">
        <h3>개념을 한 단계씩</h3>
        <span className="badge">설명용 예제</span>
      </div>
      <div className="example-picker">
        <label>
          예제 선택{" "}
          <select
            aria-label="예제 선택"
            value={variant}
            onChange={(e) => {
              setVariant(Number(e.target.value));
              setStep(0);
            }}
          >
            {examples.map((x, i) => (
              <option key={i} value={i}>
                {i + 1}. {x.title}
              </option>
            ))}
          </select>
        </label>
        <p>{lesson.description}</p>
        <p>{lesson.complexity}</p>
      </div>
      <p role="status">{frame.note}</p>
      <DiagramCanvas
        key={`${topic}-${variant}`}
        label="학습 알고리즘 상태"
        responsiveFit
        nodes={frame.nodes}
        edges={frame.edges}
      />
      <details open>
        <summary>단계별 계산 상태</summary>
        <div style={{ overflowX: "auto" }}>
          <table aria-label="단계별 계산 상태">
            <tbody>
              {frame.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="caption">
        실제 알고리즘으로 계산한 설명용 예제입니다. 제출 코드 실행 결과와는
        달라요. 위치 조정은 입력 데이터를 변경하지 않습니다. 복잡도는
        시각화·상태 저장 비용을 제외한 알고리즘 기준입니다.
      </p>
      <div className="playback">
        <button
          className="secondary"
          disabled={step === 0}
          onClick={() => setStep(0)}
        >
          처음
        </button>
        <button
          className="secondary"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          이전
        </button>
        <span>
          {step + 1} / {lesson.frames.length}
        </span>
        <button
          disabled={step === lesson.frames.length - 1}
          onClick={() => setStep((s) => s + 1)}
        >
          다음 단계
        </button>
        <button
          className="secondary"
          disabled={step === lesson.frames.length - 1}
          onClick={() => setStep(lesson.frames.length - 1)}
        >
          마지막
        </button>
      </div>
    </section>
  );
}
