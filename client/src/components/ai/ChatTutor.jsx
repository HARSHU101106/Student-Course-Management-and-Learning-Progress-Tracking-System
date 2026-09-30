import { useState } from "react";
import { aiApi } from "../../api/ai.api.js";

function formatTimestamp(seconds = 0) {
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export default function ChatTutor({
  lessonId = "dbms-lesson-1",
  timestamp = 0,
}) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submitQuestion = async (event) => {
    event.preventDefault();
    const text = question.trim();
    if (!text || loading) return;

    setMessages((current) => [...current, { from: "student", text }]);
    setQuestion("");
    setLoading(true);
    setError("");
    try {
      const result = await aiApi.askTutor(text, lessonId, timestamp);
      setMessages((current) => [
        ...current,
        {
          from: "tutor",
          text: result.answer,
          citations: result.citations || [],
        },
      ]);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "The tutor could not answer right now.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="tutor-panel" aria-label="Course tutor">
      <div className="tutor-head">
        <span className="pip">P</span>
        <div>
          <strong>Course tutor</strong>
          <small>Answers grounded in course material</small>
        </div>
        <span className="online-dot" />
      </div>
      <div className="chat-log" aria-live="polite">
        {!messages.length && (
          <div className="bubble bubble-tutor">
            Ask a question about this lecture to get started.
          </div>
        )}
        {messages.map((message, index) => (
          <div
            className={`bubble ${message.from === "student" ? "bubble-you" : "bubble-tutor"}`}
            key={`${message.from}-${index}`}
          >
            {message.text}
            {message.citations?.map((citation, citationIndex) => (
              <div
                className="source-pill"
                key={`${citation.lesson}-${citationIndex}`}
              >
                {citation.lesson} · {formatTimestamp(citation.timestamp)}
              </div>
            ))}
          </div>
        ))}
        {loading && (
          <div className="bubble bubble-tutor" role="status">
            Thinking...
          </div>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <form className="chat-form" onSubmit={submitQuestion}>
        <input
          aria-label="Ask the course tutor"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about this lecture"
        />
        <button
          aria-label="Send question"
          disabled={loading || !question.trim()}
        >
          Send
        </button>
      </form>
    </section>
  );
}
