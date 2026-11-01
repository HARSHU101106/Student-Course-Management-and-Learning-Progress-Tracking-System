import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge, Button, ConfirmDialog, ErrorBanner, Field, Modal, Notice, Spinner } from "../../components/ui.jsx";
import { useAsync, useDocumentTitle } from "../../hooks.js";
import { del, fieldErrors, get, post, put } from "../../lib/api.js";

function CourseForm({ course, onSaved }) {
  const [form, setForm] = useState({ title: course.title, description: course.description, category: course.category, level: course.level, duration: course.duration, instructor: course.instructor ?? "", tags: (course.tags ?? []).join(", ") });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    setStatus(null);
    try {
      await put(`/courses/${course.id}`, {
        ...form,
        duration: Number(form.duration),
        instructor: form.instructor.trim(),
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      setStatus("Saved.");
      onSaved();
    } catch (err) {
      setError(err);
      setErrors(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={save} noValidate>
      <h2>Course details</h2>
      {status && <Notice tone="success">{status}</Notice>}
      <ErrorBanner error={error && !Object.keys(errors).length ? error : null} />
      <Field label="Title" value={form.title} onChange={set("title")} error={errors.title} />
      <Field label="Description" as="textarea" rows="3" value={form.description} onChange={set("description")} error={errors.description} />
      <div className="form-row">
        <Field label="Category" value={form.category} onChange={set("category")} error={errors.category} />
        <Field label="Level">{(props) => <select {...props} value={form.level} onChange={set("level")}>{["Beginner", "Intermediate", "Advanced"].map((l) => <option key={l}>{l}</option>)}</select>}</Field>
        <Field label="Duration (weeks)" type="number" min="1" value={form.duration} onChange={set("duration")} error={errors.duration} />
      </div>
      <Field label="Instructor" value={form.instructor} onChange={set("instructor")} error={errors.instructor} />
      <Field label="Tags (comma separated)" value={form.tags} onChange={set("tags")} error={errors.tags} />
      <Button type="submit" loading={busy}>Save details</Button>
    </form>
  );
}

function LessonForm({ courseId, lesson, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: lesson?.title ?? "", module: lesson?.module ?? "", videoId: lesson?.videoId ?? "",
    topics: (lesson?.topics ?? []).join(", "), notes: lesson?.notes ?? "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    const payload = {
      title: form.title.trim(), module: form.module.trim(), videoId: form.videoId.trim(),
      topics: form.topics.split(",").map((t) => t.trim()).filter(Boolean), notes: form.notes,
    };
    try {
      if (lesson) await put(`/courses/${courseId}/lessons/${lesson.id}`, payload);
      else await post(`/courses/${courseId}/lessons`, payload);
      onSaved();
    } catch (err) {
      setError(err);
      setErrors(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={lesson ? "Edit lesson" : "Add lesson"} onClose={onClose} wide>
      <form className="form" onSubmit={save} noValidate>
        <ErrorBanner error={error && !Object.keys(errors).length ? error : null} />
        <Field label="Title" value={form.title} onChange={set("title")} error={errors.title} />
        <div className="form-row">
          <Field label="Module" value={form.module} onChange={set("module")} error={errors.module} />
          <Field label="YouTube video ID" hint="The 11 characters after v= in the video URL." value={form.videoId} onChange={set("videoId")} error={errors.videoId} />
        </div>
        <Field label="Topics (comma separated)" hint="Quiz questions and the study plan use topics to track mastery." value={form.topics} onChange={set("topics")} error={errors.topics} />
        <Field label="Study notes / transcript" as="textarea" rows="8" hint="The AI tutor answers only from this text, so richer notes mean better answers." value={form.notes} onChange={set("notes")} error={errors.notes} />
        <div className="form-actions"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save lesson</Button></div>
      </form>
    </Modal>
  );
}

const blankQuestion = () => ({ prompt: "", options: ["", "", "", ""], answerIndex: 0, explanation: "", topic: "" });

function QuizForm({ courseId, lessons, initial, onClose, onSaved }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [lessonId, setLessonId] = useState(initial?.lesson ?? "");
  const [questions, setQuestions] = useState(
    initial ? initial.questions.map((q) => ({ prompt: q.prompt, options: [...q.options], answerIndex: q.answerIndex, explanation: q.explanation ?? "", topic: q.topic ?? "" })) : [blankQuestion()],
  );
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const change = (qi, patch) => setQuestions((list) => list.map((q, i) => (i === qi ? { ...q, ...patch } : q)));
  const setOption = (qi, oi, value) => change(qi, { options: questions[qi].options.map((o, i) => (i === oi ? value : o)) });
  const removeOption = (qi, oi) => {
    const q = questions[qi];
    const answerIndex = q.answerIndex === oi ? 0 : q.answerIndex > oi ? q.answerIndex - 1 : q.answerIndex;
    change(qi, { options: q.options.filter((_, i) => i !== oi), answerIndex });
  };

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const payload = questions.map((q) => ({
      prompt: q.prompt.trim(),
      options: q.options.map((o) => o.trim()),
      answerIndex: q.answerIndex,
      ...(q.explanation.trim() && { explanation: q.explanation.trim() }),
      ...(q.topic.trim() && { topic: q.topic.trim() }),
    }));
    try {
      if (initial) await put(`/quizzes/${initial.id}`, { title: title.trim(), questions: payload });
      else await post("/quizzes", { course: courseId, title: title.trim(), questions: payload, ...(lessonId && { lesson: lessonId }) });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? "Review and edit quiz" : "New quiz"} onClose={onClose} wide>
      <form className="form" onSubmit={save} noValidate>
        {initial?.source === "ai" && <Notice tone="warning">Generated by AI. Check every question and answer against your lesson notes before publishing.</Notice>}
        {error && (
          <div className="banner banner-error" role="alert">
            <div>
              <p>{error.message}</p>
              {error.details?.length > 0 && <ul className="plain">{error.details.slice(0, 6).map((d, i) => <li key={i}>{d.path}: {d.message}</li>)}</ul>}
            </div>
          </div>
        )}
        <Field label="Quiz title" value={title} onChange={(e) => setTitle(e.target.value)} />
        {!initial && (
          <Field label="Lesson (optional)">
            {(props) => <select {...props} value={lessonId} onChange={(e) => setLessonId(e.target.value)}><option value="">Whole course</option>{lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select>}
          </Field>
        )}
        {questions.map((q, qi) => (
          <fieldset key={qi} className="card question">
            <legend>Question {qi + 1}</legend>
            <Field label={`Question ${qi + 1} text`} as="textarea" rows="2" value={q.prompt} onChange={(e) => change(qi, { prompt: e.target.value })} />
            <p className="muted small">Options: select the correct one.</p>
            {q.options.map((option, oi) => (
              <div key={oi} className="option-edit">
                <input type="radio" name={`correct-${qi}`} checked={q.answerIndex === oi} onChange={() => change(qi, { answerIndex: oi })} aria-label={`Mark option ${oi + 1} as correct for question ${qi + 1}`} />
                <input value={option} onChange={(e) => setOption(qi, oi, e.target.value)} aria-label={`Question ${qi + 1} option ${oi + 1}`} placeholder={`Option ${oi + 1}`} />
                <Button type="button" variant="ghost" size="sm" disabled={q.options.length <= 2} onClick={() => removeOption(qi, oi)} aria-label={`Remove option ${oi + 1} of question ${qi + 1}`}>Remove</Button>
              </div>
            ))}
            <div className="row-actions">
              <Button type="button" variant="secondary" size="sm" disabled={q.options.length >= 6} onClick={() => change(qi, { options: [...q.options, ""] })}>Add option</Button>
              <Button type="button" variant="ghost" size="sm" disabled={questions.length <= 1} onClick={() => setQuestions((list) => list.filter((_, i) => i !== qi))}>Remove question {qi + 1}</Button>
            </div>
            <div className="form-row">
              <Field label={`Question ${qi + 1} topic`} hint="Mastery is tracked per topic." value={q.topic} onChange={(e) => change(qi, { topic: e.target.value })} />
              <Field label={`Question ${qi + 1} explanation`} value={q.explanation} onChange={(e) => change(qi, { explanation: e.target.value })} />
            </div>
          </fieldset>
        ))}
        <div className="form-actions">
          <Button type="button" variant="secondary" disabled={questions.length >= 50} onClick={() => setQuestions((list) => [...list, blankQuestion()])}>Add question</Button>
          <span className="spacer" />
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>{initial ? "Save changes" : "Create quiz"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function QuizEditor({ quizId, ...props }) {
  const existing = useAsync(() => (quizId ? get(`/quizzes/${quizId}`).then((b) => b.data.quiz) : Promise.resolve(null)), [quizId]);
  if (existing.loading) return <Modal title="Loading quiz" onClose={props.onClose}><Spinner /></Modal>;
  if (existing.error) return <Modal title="Quiz" onClose={props.onClose}><ErrorBanner error={existing.error} onRetry={existing.reload} /></Modal>;
  return <QuizForm {...props} initial={existing.data} />;
}

function AiQuiz({ courseId, lessons, onDone }) {
  const [lessonId, setLessonId] = useState("");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function generate(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post("/ai/quiz/generate", { courseId, ...(lessonId && { lessonId }), count: Number(count), difficulty: "medium" });
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={generate}>
      <Field label="Generate a draft quiz from">
        {(props) => <select {...props} value={lessonId} onChange={(e) => setLessonId(e.target.value)}><option value="">Whole course</option>{lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select>}
      </Field>
      <Field label="Questions" type="number" min="1" max="10" value={count} onChange={(e) => setCount(e.target.value)} />
      <Button type="submit" variant="secondary" loading={busy}>Generate draft</Button>
      {error && <ErrorBanner error={error} />}
    </form>
  );
}

export default function AdminCourseEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const course = useAsync(() => get(`/courses/${id}`).then((b) => b.data.course), [id]);
  const lessons = useAsync(() => get(`/courses/${id}/lessons`).then((b) => b.data), [id]);
  const quizzes = useAsync(() => get("/quizzes", { courseId: id, status: "all" }).then((b) => b.data), [id]);
  const [editing, setEditing] = useState(null); // lesson | "new" | null
  const [quizEditor, setQuizEditor] = useState(null); // { id } to edit, {} for new
  const [deleting, setDeleting] = useState(null);
  const [confirmCourse, setConfirmCourse] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [playlist, setPlaylist] = useState("");
  useDocumentTitle(course.data?.title);

  if (course.loading && !course.data) return <Spinner />;
  if (course.error) return <><ErrorBanner error={course.error} /><Link to="/admin/courses">Back</Link></>;
  const c = course.data;
  const list = lessons.data ?? [];

  async function run(action, success) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      if (success) setMessage(typeof success === "function" ? success(result) : success);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const refreshAll = () => { course.reload(); lessons.reload(); quizzes.reload(); };

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb"><Link to="/admin/courses">Courses</Link> / <span>{c.title}</span></nav>
      <div className="page-header">
        <div>
          <h1>{c.title}</h1>
          <p className="muted"><Badge tone={c.status === "published" ? "success" : "warning"}>{c.status}</Badge> · {list.length} lessons{c.source?.type === "youtube-playlist" && " · linked to a YouTube playlist"}</p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-secondary" to={`/courses/${c.slug}`}>View as student</Link>
          <Button variant="secondary" loading={busy} onClick={() => run(() => put(`/courses/${c.id}`, { status: c.status === "published" ? "draft" : "published" }).then(course.reload), c.status === "published" ? "Course unpublished." : "Course published. Students have been notified.")}>
            {c.status === "published" ? "Unpublish" : "Publish"}
          </Button>
          <Button variant="danger" onClick={() => setConfirmCourse(true)}>Delete</Button>
        </div>
      </div>
      {message && <Notice tone="success">{message}</Notice>}
      <ErrorBanner error={error} />

      <CourseForm course={c} onSaved={course.reload} />

      <section className="card section" aria-labelledby="lessons-title">
        <div className="section-head"><h2 id="lessons-title">Lessons</h2><Button onClick={() => setEditing("new")}>Add lesson</Button></div>
        {lessons.loading && !lessons.data ? <Spinner /> : list.length === 0 ? <p className="muted">No lessons yet.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">#</th><th scope="col">Title</th><th scope="col">Module</th><th scope="col">Video</th><th scope="col">Notes</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
              <tbody>
                {list.map((lesson) => (
                  <tr key={lesson.id}>
                    <td>{lesson.order}</td><td>{lesson.title}</td><td>{lesson.module || "—"}</td>
                    <td>{lesson.videoId ? <Badge tone="success">attached</Badge> : <Badge tone="muted">none</Badge>}</td>
                    <td>{lesson.notes ? `${lesson.notes.length.toLocaleString()} chars` : <Badge tone="warning">empty</Badge>}</td>
                    <td className="row-actions"><Button size="sm" variant="ghost" onClick={() => setEditing(lesson)}>Edit</Button><Button size="sm" variant="ghost" aria-label={`Delete lesson ${lesson.title}`} onClick={() => setDeleting(lesson)}>Delete</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run(() => post(`/admin/courses/${c.id}/attach-playlist`, { url: playlist.trim() }).then((b) => { refreshAll(); return b; }), (b) => b.message ?? "Playlist attached."); }}>
          <Field label="Attach videos from a YouTube playlist" type="url" placeholder="https://www.youtube.com/playlist?list=…" hint="Videos are matched to lessons by title; unmatched lessons are left untouched." value={playlist} onChange={(e) => setPlaylist(e.target.value)} />
          <Button type="submit" variant="secondary" loading={busy} disabled={!playlist.trim()}>Attach videos</Button>
        </form>
      </section>

      <section className="card section" aria-labelledby="quizzes-title">
        <div className="section-head"><h2 id="quizzes-title">Quizzes</h2><div className="row-actions"><Button variant="secondary" loading={busy} onClick={() => run(() => post(`/admin/courses/${c.id}/reindex`), "AI index refreshed.")}>Re-index for AI tutor</Button><Button onClick={() => setQuizEditor({})}>New quiz</Button></div></div>
        {(quizzes.data ?? []).length === 0 ? <p className="muted">No quizzes yet.</p> : (
          <ul className="list">
            {quizzes.data.map((quiz) => (
              <li key={quiz.id} className="list-row">
                <div><strong>{quiz.title}</strong> <Badge tone={quiz.status === "published" ? "success" : "warning"}>{quiz.status}</Badge> {quiz.source === "ai" && <Badge tone="info">AI draft</Badge>}<p className="muted">{quiz.questionCount} questions</p></div>
                <div className="row-actions">
                  <Button size="sm" variant="secondary" aria-label={`Review ${quiz.title}`} onClick={() => setQuizEditor({ id: quiz.id })}>Review</Button>
                  {quiz.status === "draft" && <Button size="sm" onClick={() => run(() => put(`/quizzes/${quiz.id}`, { status: "published" }).then(quizzes.reload), "Quiz published.")}>Publish</Button>}
                  <Button size="sm" variant="ghost" aria-label={`Delete quiz ${quiz.title}`} onClick={() => run(() => del(`/quizzes/${quiz.id}`).then(quizzes.reload), "Quiz deleted.")}>Delete</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <AiQuiz courseId={c.id} lessons={list} onDone={() => { quizzes.reload(); setMessage("Draft quiz created. Review and publish it above."); }} />
      </section>

      {quizEditor && <QuizEditor courseId={c.id} lessons={list} quizId={quizEditor.id} onClose={() => setQuizEditor(null)} onSaved={() => { setQuizEditor(null); quizzes.reload(); setMessage("Quiz saved."); }} />}
      {editing && <LessonForm courseId={c.id} lesson={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refreshAll(); }} />}
      {deleting && <ConfirmDialog title="Delete lesson" message={`Delete "${deleting.title}"? Student progress will be recalculated.`} busy={busy} onCancel={() => setDeleting(null)} onConfirm={() => run(() => del(`/courses/${c.id}/lessons/${deleting.id}`).then(() => { setDeleting(null); refreshAll(); }), "Lesson deleted.")} />}
      {confirmCourse && <ConfirmDialog title="Delete course" message={`Delete "${c.title}" and everything attached to it? This cannot be undone.`} busy={busy} onCancel={() => setConfirmCourse(false)} onConfirm={() => run(() => del(`/courses/${c.id}`).then(() => navigate("/admin/courses")))} />}
    </>
  );
}
