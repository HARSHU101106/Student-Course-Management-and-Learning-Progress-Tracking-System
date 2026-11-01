import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { post } from "../lib/api.js";
import { Badge, Button } from "./ui.jsx";

const SAMPLE = ["Explain the key idea of this lesson", "What should I remember for an exam?"];

export default function TutorPanel({ courseId, lessonId }) {
  const [turns, setTurns] = useState([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef(null);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "nearest" });
  }, [turns, busy]);

  async function ask(text) {
    const q = text.trim();
    if (q.length < 3 || busy) return;
    const history = turns
      .filter((turn) => !turn.error)
      .slice(-3)
      .flatMap((turn) => [
        { role: "user", content: turn.question },
        { role: "assistant", content: turn.answer.slice(0, 1400) },
      ]);
    setQuestion("");
    setBusy(true);
    setTurns((current) => [...current, { question: q, pending: true }]);
    try {
      const body = await post("/ai/tutor", { courseId, lessonId, question: q, history });
      setTurns((current) => [...current.slice(0, -1), { question: q, ...body.data }]);
    } catch (error) {
      const message = error.status === 503 ? "The AI tutor is not available right now. Please try again in a moment." : error.message;
      setTurns((current) => [...current.slice(0, -1), { question: q, answer: message, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tutor" aria-label="AI tutor">
      <div className="tutor-log" role="log" aria-live="polite">
        {turns.length === 0 && (
          <div className="muted">
            <p>Ask a question about this course. Answers come only from the lesson material, with sources.</p>
            <div className="chips">
              {SAMPLE.map((text) => (
                <button key={text} className="chip" onClick={() => ask(text)}>{text}</button>
              ))}
            </div>
          </div>
        )}
        {turns.map((turn, index) => (
          <div key={index} className="tutor-turn">
            <p className="bubble bubble-self">{turn.question}</p>
            {turn.pending ? (
              <p className="bubble bubble-other muted" aria-busy="true">Thinking…</p>
            ) : (
              <div className={`bubble bubble-other ${turn.error ? "bubble-error" : ""}`}>
                <p>{turn.answer}</p>
                {!turn.error && (
                  <p className="tutor-meta">
                    {turn.refused ? <Badge tone="warning">Declined</Badge> : turn.grounded ? <Badge tone="success">From course material</Badge> : <Badge tone="warning">Not in course material</Badge>}
                  </p>
                )}
                {turn.citations?.length > 0 && (
                  <ol className="citations">
                    {turn.citations.map((citation, i) => (
                      <li key={i}>
                        <Link to={`/lessons/${citation.lessonId}`}>{citation.title}</Link>
                        <span className="muted"> — {citation.snippet}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {turn.suggestions?.length > 0 && (
                  <p className="muted">Closest lessons: {turn.suggestions.join(", ")}</p>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        className="tutor-form"
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
      >
        <label htmlFor="tutor-question" className="visually-hidden">Your question</label>
        <input id="tutor-question" value={question} maxLength={500} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about this lesson…" autoComplete="off" />
        <Button type="submit" loading={busy} disabled={question.trim().length < 3}>Ask</Button>
      </form>
    </section>
  );
}
