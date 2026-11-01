import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge, Button, ErrorBanner, Notice, ProgressBar, Spinner } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAsync, useDocumentTitle } from "../hooks.js";
import { del, get, post } from "../lib/api.js";
import { formatSeconds, pluralize } from "../lib/format.js";

function groupByModule(lessons) {
  const groups = [];
  for (const lesson of lessons) {
    const name = lesson.module || "Lessons";
    const last = groups.at(-1);
    if (last && last.name === name) last.lessons.push(lesson);
    else groups.push({ name, lessons: [lesson] });
  }
  return groups;
}

export default function CourseDetail() {
  const { slug } = useParams();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const { data, loading, error, reload } = useAsync(() => get(`/courses/${slug}`).then((b) => b.data), [slug, user?.id]);
  const enrolled = data?.enrollment && data.enrollment.status !== "dropped";
  const quizzes = useAsync(
    () => (enrolled && data?.course ? get("/quizzes", { courseId: data.course.id }).then((b) => b.data) : Promise.resolve([])),
    [data?.course?.id, enrolled],
  );
  useDocumentTitle(data?.course?.title);

  if (loading && !data) return <Spinner label="Loading course" />;
  if (error) {
    return (
      <>
        <ErrorBanner error={error} onRetry={reload} />
        <Link to="/courses">Back to courses</Link>
      </>
    );
  }

  const { course, lessons } = data;
  // A newly enrolled student has no progress record yet: show 0% rather than nothing.
  const progress = data.progress ?? (enrolled ? { percent: 0, completedLessons: 0, totalLessons: lessons.length, completedLessonIds: [], lastLesson: null } : null);
  const completed = new Set(progress?.completedLessonIds ?? []);
  const canOpen = enrolled || isAdmin;

  async function toggleEnrollment() {
    setBusy(true);
    setActionError(null);
    try {
      if (enrolled) await del(`/enrollments/${course.id}`);
      else await post("/enrollments", { courseId: course.id });
      await reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  }

  const resumeId = progress?.lastLesson ?? lessons[0]?.id;

  return (
    <>
      <nav aria-label="Breadcrumb" className="breadcrumb"><Link to="/courses">Courses</Link> / <span>{course.title}</span></nav>
      <header className="course-hero card">
        <div className="card-badges">
          <Badge>{course.category}</Badge>
          <Badge tone="muted">{course.level}</Badge>
          {course.status === "draft" && <Badge tone="warning">Draft</Badge>}
          {data.enrollment?.status === "completed" && <Badge tone="success">Completed</Badge>}
        </div>
        <h1>{course.title}</h1>
        <p>{course.description}</p>
        <p className="card-meta">
          {pluralize(course.duration, "week")} · {pluralize(lessons.length, "lesson")}
          {course.instructor ? ` · ${course.instructor}` : ""}
        </p>
        {enrolled && progress && (
          <div>
            <ProgressBar value={progress.percent} label={`${course.title} progress`} />
            <p className="muted">{progress.completedLessons} of {progress.totalLessons || lessons.length} lessons complete ({progress.percent}%)</p>
          </div>
        )}
        <ErrorBanner error={actionError} />
        <div className="hero-actions">
          {!user && <Link className="btn btn-primary" to="/login" state={{ from: `/courses/${slug}` }}>Sign in to enrol</Link>}
          {user && !isAdmin && (
            <Button variant={enrolled ? "secondary" : "primary"} loading={busy} onClick={toggleEnrollment}>
              {enrolled ? "Unenrol" : "Enrol in this course"}
            </Button>
          )}
          {enrolled && resumeId && <Link className="btn btn-primary" to={`/lessons/${resumeId}`}>{progress?.percent ? "Continue learning" : "Start learning"}</Link>}
          {enrolled && <Link className="btn btn-secondary" to={`/chat?course=${course.id}`}>Course chat</Link>}
          {isAdmin && <Link className="btn btn-secondary" to={`/admin/courses/${course.id}`}>Edit course</Link>}
        </div>
      </header>

      <section aria-labelledby="curriculum" className="section">
        <h2 id="curriculum">Curriculum</h2>
        {!canOpen && user && <Notice>Enrol to unlock lessons, notes, quizzes and the AI tutor.</Notice>}
        {lessons.length === 0 && <Notice>This course has no lessons yet.</Notice>}
        {groupByModule(lessons).map((group) => (
          <div key={group.name} className="module">
            <h3>{group.name}</h3>
            <ol className="lesson-list">
              {group.lessons.map((lesson) => (
                <li key={lesson.id} className={completed.has(lesson.id) ? "done" : ""}>
                  {canOpen ? <Link to={`/lessons/${lesson.id}`}>{lesson.title}</Link> : <span>{lesson.title}</span>}
                  <span className="lesson-meta">
                    {!lesson.hasVideo && <Badge tone="muted">notes only</Badge>}
                    {lesson.durationSec > 0 && <span className="muted">{formatSeconds(lesson.durationSec)}</span>}
                    {completed.has(lesson.id) && <span className="check" aria-label="Completed">✓</span>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      {enrolled && (
        <section aria-labelledby="quizzes" className="section">
          <h2 id="quizzes">Quizzes</h2>
          {quizzes.loading ? <Spinner /> : (quizzes.data ?? []).length === 0 ? <p className="muted">No quizzes have been published for this course yet.</p> : (
            <ul className="list">
              {quizzes.data.map((quiz) => (
                <li key={quiz.id} className="list-row">
                  <div>
                    <strong>{quiz.title}</strong>
                    <p className="muted">{pluralize(quiz.questionCount, "question")}{quiz.bestPercent !== null && ` · best score ${quiz.bestPercent}% over ${pluralize(quiz.attempts, "attempt")}`}</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => navigate(`/quizzes/${quiz.id}`)}>{quiz.attempts ? "Retake" : "Start"}</Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
