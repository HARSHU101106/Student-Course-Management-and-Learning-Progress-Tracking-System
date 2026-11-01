import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, EmptyState, ErrorBanner, Notice, PageHeader, ProgressBar, Spinner } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAsync, useDocumentTitle } from "../hooks.js";
import { get, post } from "../lib/api.js";

const TYPE_LABEL = { revisit: ["Revisit", "warning"], practice: ["Practice", "info"], advance: ["Next up", "success"] };

function StudyPlan({ courses }) {
  const [courseId, setCourseId] = useState(courses[0]?.course.id ?? "");
  const [busy, setBusy] = useState(false);
  const plan = useAsync(() => (courseId ? get(`/ai/plan/${courseId}`).then((b) => b.data) : Promise.resolve(null)), [courseId]);

  useEffect(() => {
    if (!courseId && courses[0]) setCourseId(courses[0].course.id);
  }, [courses, courseId]);

  async function regenerate() {
    setBusy(true);
    try {
      const body = await post(`/ai/plan/${courseId}/regenerate`);
      plan.setData(body.data);
    } catch (error) {
      plan.setData(null);
      await plan.reload();
      void error;
    } finally {
      setBusy(false);
    }
  }

  const items = plan.data?.plan?.items ?? [];
  return (
    <section className="card" aria-labelledby="plan-title">
      <div className="section-head">
        <h2 id="plan-title">Your study plan</h2>
        {courses.length > 1 && (
          <select aria-label="Course for study plan" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {courses.map(({ course }) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
        )}
      </div>
      {plan.loading ? <Spinner label="Building your plan" /> : plan.error ? (
        <ErrorBanner error={plan.error.status === 503 ? new Error("The study planner is not available right now.") : plan.error} onRetry={plan.reload} />
      ) : (
        <>
          {plan.data?.stale && <Notice tone="warning">Showing your last saved plan: the planner is temporarily unavailable.</Notice>}
          {plan.data?.plan?.summary && <p>{plan.data.plan.summary}</p>}
          {items.length === 0 ? <p className="muted">Nothing to do right now: you are all caught up.</p> : (
            <ol className="plan-list">
              {items.map((item, index) => {
                const [label, tone] = TYPE_LABEL[item.type] ?? ["Task", "neutral"];
                const target = item.lessonId ? `/lessons/${item.lessonId}` : `/courses/${courseId}`;
                return (
                  <li key={index}>
                    <div>
                      <Badge tone={tone}>{label}</Badge> <Link to={target}>{item.title}</Link>
                      <p className="muted">{item.reason}</p>
                    </div>
                    <span className="muted">{item.minutes} min</span>
                  </li>
                );
              })}
            </ol>
          )}
          <Button variant="secondary" size="sm" loading={busy} onClick={regenerate}>Regenerate plan</Button>
        </>
      )}
    </section>
  );
}

export default function Dashboard() {
  useDocumentTitle("Dashboard");
  const { user } = useAuth();
  const summary = useAsync(() => get("/progress/summary").then((b) => b.data), []);
  const mine = useAsync(() => get("/enrollments/my-courses").then((b) => b.data), []);

  if (mine.loading || summary.loading) return <Spinner label="Loading your dashboard" />;
  const courses = mine.data ?? [];
  const s = summary.data;

  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(" ")[0]}`} subtitle="Here is where you stand." actions={<Link className="btn btn-primary" to="/courses">Browse courses</Link>} />
      <ErrorBanner error={summary.error || mine.error} onRetry={() => { summary.reload(); mine.reload(); }} />

      {s && (
        <div className="grid grid-4 stats">
          {[["Enrolled", s.enrolled], ["In progress", s.inProgress], ["Completed", s.completed], ["Average progress", `${s.averagePercent}%`], ["Lessons done", s.lessonsCompleted], ["Minutes this week", s.minutesThisWeek]].map(([label, value]) => (
            <div className="card stat" key={label}>
              <p className="stat-value">{value}</p>
              <p className="muted">{label}</p>
            </div>
          ))}
        </div>
      )}

      {courses.length === 0 ? (
        <EmptyState title="You have not enrolled in any course yet" action={<Link className="btn btn-primary" to="/courses">Find a course</Link>}>
          Enrol in a course to track progress and get a personalised study plan.
        </EmptyState>
      ) : (
        <div className="dash-grid">
          <section aria-labelledby="my-courses">
            <h2 id="my-courses">My courses</h2>
            <ul className="list">
              {courses.map(({ id, course, progress, status }) => (
                <li key={id} className="card list-card">
                  <div className="list-head">
                    <Link to={`/courses/${course.slug}`}><strong>{course.title}</strong></Link>
                    {status === "completed" && <Badge tone="success">Completed</Badge>}
                  </div>
                  <ProgressBar value={progress.percent} label={`${course.title} progress`} />
                  <p className="muted">{progress.completedLessons} of {progress.totalLessons} lessons · {progress.percent}%</p>
                  <Link className="btn btn-secondary btn-sm" to={progress.lastLesson ? `/lessons/${progress.lastLesson}` : `/courses/${course.slug}`}>
                    {progress.percent ? "Continue" : "Start"}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <StudyPlan courses={courses} />
        </div>
      )}
    </>
  );
}
