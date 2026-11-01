import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, EmptyState, ErrorBanner, Field, Notice, PageHeader, Spinner } from "../../components/ui.jsx";
import { useAsync, useDocumentTitle } from "../../hooks.js";
import { fieldErrors, get, post } from "../../lib/api.js";
import { timeAgo } from "../../lib/format.js";

function Announcement({ courses }) {
  const [form, setForm] = useState({ title: "", body: "", courseId: "" });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});

  async function send(event) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    setError(null);
    setErrors({});
    try {
      const body = await post("/notifications/broadcast", {
        title: form.title.trim(),
        ...(form.body.trim() && { body: form.body.trim() }),
        ...(form.courseId && { courseId: form.courseId }),
      });
      setStatus(`Sent to ${body.data.recipients} student${body.data.recipients === 1 ? "" : "s"}.`);
      setForm({ title: "", body: "", courseId: "" });
    } catch (err) {
      setError(err);
      setErrors(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={send} noValidate>
      <h2>Send an announcement</h2>
      <p className="muted">Students see it instantly if they are online, and in their notification list otherwise.</p>
      {status && <Notice tone="success">{status}</Notice>}
      <ErrorBanner error={error && !Object.keys(errors).length ? error : null} />
      <Field label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={errors.title} />
      <Field label="Message (optional)" as="textarea" rows="3" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} error={errors.body} />
      <Field label="Audience">
        {(props) => (
          <select {...props} value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
            <option value="">All students</option>
            {courses.map((course) => <option key={course.id} value={course.id}>Students in {course.title}</option>)}
          </select>
        )}
      </Field>
      <Button type="submit" loading={busy} disabled={form.title.trim().length < 2}>Send announcement</Button>
    </form>
  );
}

export default function AdminDashboard() {
  useDocumentTitle("Admin");
  const stats = useAsync(() => get("/admin/stats").then((b) => b.data), []);
  const risk = useAsync(() => get("/admin/reports/at-risk").then((b) => b.data), []);
  const gaps = useAsync(() => get("/admin/reports/content-gaps").then((b) => b.data), []);
  const courses = useAsync(() => get("/courses", { status: "published", limit: 50 }).then((b) => b.data), []);

  const s = stats.data;
  return (
    <>
      <PageHeader title="Admin console" subtitle="Platform health and students who need attention." actions={<><Link className="btn btn-secondary" to="/admin/studio">Course Studio</Link><Link className="btn btn-primary" to="/admin/courses">Manage courses</Link></>} />
      <ErrorBanner error={stats.error} onRetry={stats.reload} />
      {stats.loading ? <Spinner /> : s && (
        <div className="grid grid-4 stats">
          {[["Students", s.students], ["Courses published", `${s.publishedCourses} / ${s.courses}`], ["Active enrolments", s.enrollments], ["Completions", s.completions], ["Quiz attempts", s.quizAttempts], ["Average quiz score", `${s.averageQuizPercent}%`], ["Active (7 days)", s.activeStudents7d]].map(([label, value]) => (
            <div className="card stat" key={label}><p className="stat-value">{value}</p><p className="muted">{label}</p></div>
          ))}
        </div>
      )}

      <section className="card section" aria-labelledby="risk-title">
        <h2 id="risk-title">Students at risk</h2>
        {risk.loading ? <Spinner /> : (risk.data ?? []).length === 0 ? <p className="muted">No students are flagged right now.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Student</th><th scope="col">Course</th><th scope="col">Progress</th><th scope="col">Why</th></tr></thead>
              <tbody>
                {risk.data.map((row) => (
                  <tr key={`${row.student.id}-${row.course.id}`}>
                    <td>{row.student.name}<br /><span className="muted small">{row.student.email}</span></td>
                    <td>{row.course.title}</td>
                    <td>{row.percent}%{row.averageMastery !== null && <><br /><span className="muted small">mastery {row.averageMastery}%</span></>}</td>
                    <td><Badge tone={row.riskLevel === "high" ? "danger" : "warning"}>{row.riskLevel}</Badge><ul className="plain">{row.reasons.map((r) => <li key={r}>{r}</li>)}</ul></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid grid-2 section">
        <section className="card" aria-labelledby="gaps-title">
          <h2 id="gaps-title">Content gaps</h2>
          <p className="muted">Questions the AI tutor could not answer from course material.</p>
          {gaps.loading ? <Spinner /> : (gaps.data ?? []).length === 0 ? <EmptyState title="No gaps recorded">Unanswered student questions will appear here.</EmptyState> : (
            <ul className="list">
              {gaps.data.slice(0, 8).map((gap) => (
                <li key={gap.id} className="list-row"><div><p>{gap.question}</p><p className="muted small">{gap.course?.title} · {timeAgo(gap.at)}</p></div></li>
              ))}
            </ul>
          )}
        </section>
        <Announcement courses={courses.data ?? []} />
      </div>
    </>
  );
}
