import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorBanner, Field, Modal, PageHeader, Pagination, Spinner } from "../../components/ui.jsx";
import { useAsync, useDocumentTitle } from "../../hooks.js";
import { del, fieldErrors, get, post, put } from "../../lib/api.js";

const blank = { title: "", description: "", category: "", level: "Beginner", duration: 4, instructor: "" };

function NewCourse({ onClose, onCreated }) {
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const body = await post("/courses", { ...form, duration: Number(form.duration), instructor: form.instructor.trim() || undefined });
      onCreated(body.data.course);
    } catch (err) {
      setError(err);
      setErrors(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New course" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <ErrorBanner error={error && !Object.keys(errors).length ? error : null} />
        <Field label="Title" value={form.title} onChange={set("title")} error={errors.title} />
        <Field label="Description" as="textarea" rows="3" value={form.description} onChange={set("description")} error={errors.description} />
        <div className="form-row">
          <Field label="Category" value={form.category} onChange={set("category")} error={errors.category} />
          <Field label="Level" error={errors.level}>
            {(props) => <select {...props} value={form.level} onChange={set("level")}>{["Beginner", "Intermediate", "Advanced"].map((l) => <option key={l}>{l}</option>)}</select>}
          </Field>
          <Field label="Duration (weeks)" type="number" min="1" max="104" value={form.duration} onChange={set("duration")} error={errors.duration} />
        </div>
        <Field label="Instructor (optional)" value={form.instructor} onChange={set("instructor")} error={errors.instructor} />
        <p className="muted small">New courses start as drafts. Publish them from the course editor once lessons are added.</p>
        <div className="form-actions"><Button variant="secondary" type="button" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Create course</Button></div>
      </form>
    </Modal>
  );
}

export default function AdminCourses() {
  useDocumentTitle("Manage courses");
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const { data, loading, error, reload } = useAsync(() => get("/courses", { status, page, limit: 12, sort: "newest" }), [status, page]);

  async function togglePublish(course) {
    setActionError(null);
    try {
      await put(`/courses/${course.id}`, { status: course.status === "published" ? "draft" : "published" });
      await reload();
    } catch (err) {
      setActionError(err);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await del(`/courses/${deleting.id}`);
      setDeleting(null);
      await reload();
    } catch (err) {
      setActionError(err);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  const courses = data?.data ?? [];
  return (
    <>
      <PageHeader title="Manage courses" actions={<><Link className="btn btn-secondary" to="/admin/studio">Import from YouTube</Link><Button onClick={() => setCreating(true)}>New course</Button></>} />
      <div className="filters card">
        <Field label="Show">
          {(props) => <select {...props} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="all">All courses</option><option value="published">Published</option><option value="draft">Drafts</option></select>}
        </Field>
      </div>
      <ErrorBanner error={error || actionError} onRetry={reload} />
      {loading && !data ? <Spinner /> : courses.length === 0 ? <EmptyState title="No courses found" /> : (
        <div className="table-wrap card">
          <table>
            <thead><tr><th scope="col">Title</th><th scope="col">Category</th><th scope="col">Lessons</th><th scope="col">Status</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id}>
                  <td><Link to={`/admin/courses/${course.id}`}>{course.title}</Link></td>
                  <td>{course.category}</td>
                  <td>{course.lessonCount}</td>
                  <td><Badge tone={course.status === "published" ? "success" : "warning"}>{course.status}</Badge></td>
                  <td className="row-actions">
                    <Button size="sm" variant="secondary" onClick={() => togglePublish(course)}>{course.status === "published" ? "Unpublish" : "Publish"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/courses/${course.id}`)}>Edit</Button>
                    <Button size="sm" variant="ghost" aria-label={`Delete ${course.title}`} onClick={() => setDeleting(course)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={data?.meta} onPage={setPage} />
      {creating && <NewCourse onClose={() => setCreating(false)} onCreated={(course) => navigate(`/admin/courses/${course.id}`)} />}
      {deleting && <ConfirmDialog title="Delete course" message={`Delete "${deleting.title}" with all its lessons, quizzes, enrolments and progress? This cannot be undone.`} busy={busy} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}
    </>
  );
}
