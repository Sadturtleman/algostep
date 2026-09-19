import React, { useState } from "react";
import { post } from "./api.js";
export function QuizPanel({
  topic,
  onError,
}: {
  topic: any;
  onError: (e: any) => void;
}) {
  const questions = topic.quizzes ?? [topic.quiz];
  const [index, setIndex] = useState(0),
    [answer, setAnswer] = useState<number | null>(null),
    [feedback, setFeedback] = useState<any>(null),
    [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const q = questions[index];
  const move = (next: number) => {
    setIndex(next);
    setAnswer(null);
    setFeedback(null);
  };
  return (
    <section className="panel quiz">
      <span className="eyebrow">CHECK YOUR UNDERSTANDING</span>
      <h2>잠깐, 이해했나요?</h2>
      <p>
        문항 {index + 1} / {questions.length} · 확인{" "}
        {Object.keys(results).length}개 · 정답{" "}
        {Object.values(results).filter(Boolean).length}개
      </p>
      <div className="quiz-navigation" aria-label="문항 선택">
        {questions.map((item: any, i: number) => (
          <button
            key={item.id ?? i}
            className={i === index ? "" : "secondary"}
            disabled={busy}
            aria-label={`문항 ${i + 1}`}
            aria-pressed={i === index}
            onClick={() => move(i)}
          >
            {i + 1}
            {results[item.id] === true
              ? " ✓"
              : results[item.id] === false
                ? " ·"
                : ""}
          </button>
        ))}
      </div>
      <h3>{q.question}</h3>
      {q.options.map((option: string, i: number) => (
        <button
          key={i}
          disabled={!!feedback || busy}
          className={`quiz-option ${answer === i ? "selected" : ""} ${feedback?.answer === i ? "correct" : ""}`}
          onClick={() => setAnswer(i)}
        >
          <span>{i + 1}</span>
          {option}
        </button>
      ))}
      {feedback ? (
        <div className="quiz-feedback" role="status">
          <strong>
            {feedback.correct ? "정답이에요!" : "다시 살펴볼까요?"}
          </strong>
          <p>{feedback.explanation}</p>
          <button
            className="secondary"
            onClick={() => {
              setFeedback(null);
              setAnswer(null);
            }}
          >
            다시 풀기
          </button>
        </div>
      ) : (
        <button
          disabled={answer === null || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await post(`/quiz/${topic.id}`, {
                answer,
                questionId: q.id ?? "core",
                requestKey: crypto.randomUUID(),
              });
              setFeedback(result);
              setResults((prev) => ({ ...prev, [q.id]: result.correct }));
            } catch (e) {
              onError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "확인 중…" : "정답 확인"}
        </button>
      )}
      <div className="playback">
        <button
          className="secondary"
          disabled={busy || index === 0}
          onClick={() => move(index - 1)}
        >
          이전 문항
        </button>
        <button
          className="secondary"
          disabled={busy || index === questions.length - 1}
          onClick={() => move(index + 1)}
        >
          다음 문항
        </button>
      </div>
    </section>
  );
}
