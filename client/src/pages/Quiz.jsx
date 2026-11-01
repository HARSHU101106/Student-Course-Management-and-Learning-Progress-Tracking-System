import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, ErrorBanner, Spinner } from "../components/ui.jsx";
import { useAsync, useDocumentTitle } from "../hooks.js";
import { get, post } from "../lib/api.js";

export default function Quiz() {
  const { id } = useParams();
  const { data: quiz, loading, error, reload } = useAsync(() => get(`/quizzes/${id}`).then((b) => b.data.quiz), [id]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  useDocumentTitle(quiz?.title);

  if (loading && !quiz) return <Spinner label="Loading quiz" />;
  if (error) return <><ErrorBanner error={error} onRetry={reload} /><Link to="/courses">Back to courses</Link></>;

  const answered = Object.keys(answers).length;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setSubmitError(null);
    try {
      const body = await post(`/quizzes/${id}/attempts`, { answers: quiz.questions.map((_, index) => answers[index] ?? -1) });
      setResult(body.data);
      window.scrollTo?.({ top: 0 });
    } catch (err) {
      setSubmitError(err);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const { attempt, review } = result;
    return (
      <>
        <h1>{quiz.title}: results</h1>
        <div className="card result-card" role="status">
          <p className="score" data-testid="quiz-score">{attempt.score} / {attempt.total}</p>
          <p className="muted">{attempt.percent}% correct</p>
        </div>
        <ol className="review">
          {review.map((item, index) => (
            <li key={item.questionId} className={`card ${item.correct ? "review-correct" : "review-wrong"}`}>
              <p><strong>{index + 1}. {item.prompt}</strong> <Badge tone={item.correct ? "success" : "danger"}>{item.correct ? "Correct" : "Incorrect"}</Badge></p>
              <p>Your answer: {item.selectedIndex >= 0 ? item.options[item.selectedIndex] : <em>not answered</em>}</p>
              {!item.correct && <p>Correct answer: <strong>{item.options[item.correctIndex]}</strong></p>}
              {item.explanation && <p className="muted">{item.explanation}</p>}
            </li>
          ))}
        </ol>
        <div className="form-actions">
          <Button variant="secondary" onClick={() => { setResult(null); setAnswers({}); }}>Retake quiz</Button>
          <Link className="btn btn-primary" to={`/courses/${quiz.course}`}>Back to course</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <nav aria-label="Breadcrumb" className="breadcrumb"><Link to={`/courses/${quiz.course}`}>Course</Link> / <span>Quiz</span></nav>
      <h1>{quiz.title}</h1>
      <form onSubmit={submit}>
        <ErrorBanner error={submitError} />
        {quiz.questions.map((question, index) => (
          <fieldset key={question.id} className="card question">
            <legend>{index + 1}. {question.prompt}</legend>
            {question.options.map((option, optionIndex) => (
              <label key={optionIndex} className="option">
                <input type="radio" name={`q-${index}`} checked={answers[index] === optionIndex} onChange={() => setAnswers({ ...answers, [index]: optionIndex })} />
                <span>{option}</span>
              </label>
            ))}
          </fieldset>
        ))}
        <div className="form-actions">
          <span className="muted" aria-live="polite">{answered} of {quiz.questions.length} answered</span>
          <Button type="submit" loading={busy} disabled={answered === 0}>Submit answers</Button>
        </div>
      </form>
    </>
  );
}
