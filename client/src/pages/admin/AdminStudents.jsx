import { useState } from "react";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorBanner, Field, Modal, PageHeader, Pagination, Spinner } from "../../components/ui.jsx";
import { useAsync, useDebounced, useDocumentTitle } from "../../hooks.js";
import { del, fieldErrors, get, post, put } from "../../lib/api.js";

function StudentForm({ student, onClose, onSaved }) {
  const [form, setForm] = useState({ name: student?.name ?? "", email: student?.email ?? "", department: student?.department ?? "", password: "", isActive: student?.isActive ?? true });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      if (student) {
        await put(`/students/${student.id}`, { name: form.name.trim(), email: form.email.trim(), department: form.department.trim(), isActive: form.isActive, ...(form.password && { password: form.password }) });
      } else {
        await post("/students", { name: form.name.trim(), email: form.email.trim(), password: form.password, ...(form.department.trim() && { department: form.department.trim() }) });
      }
      onSaved();
    } catch (err) {
      setError(err);
      setErrors(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={student ? "Edit student" : "Add student"} onClose={onClose}>
      <form className="form" onSubmit={save} noValidate>
        <ErrorBanner error={error && !Object.keys(errors).length ? error : null} />
        <Field label="Full name" value={form.name} onChange={set("name")} error={errors.name} />
        <Field label="Email" type="email" value={form.email} onChange={set("email")} error={errors.email} />
        <Field label="Department" value={form.department} onChange={set("department")} error={errors.department} />
        <Field label={student ? "New password (leave blank to keep)" : "Password"} type="password" autoComplete="new-password" hint="At least 12 characters." value={form.password} onChange={set("password")} error={errors.password} />
        {student && (
          <label className="check-row"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Account is active</label>
        )}
        <div className="form-actions"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>{student ? "Save changes" : "Add student"}</Button></div>
      </form>
    </Modal>
  );
}

export default function AdminStudents() {
  useDocumentTitle("Students");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const search = useDebounced(q, 300);
  const { data, loading, error, reload } = useAsync(() => get("/students", { q: search || undefined, page, limit: 10 }), [search, page]);
  const students = data?.data ?? [];

  async function confirmDelete() {
    setBusy(true);
    try {
      await del(`/students/${deleting.id}`);
      setDeleting(null);
      await reload();
    } catch (err) {
      setActionError(err);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Students" actions={<Button onClick={() => setEditing("new")}>Add student</Button>} />
      <div className="filters card">
        <Field label="Search" type="search" placeholder="Name, email or department" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>
      <ErrorBanner error={error || actionError} onRetry={reload} />
      {loading && !data ? <Spinner /> : students.length === 0 ? <EmptyState title="No students found" /> : (
        <div className="table-wrap card">
          <table>
            <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Department</th><th scope="col">Courses</th><th scope="col">Status</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td><td>{s.email}</td><td>{s.department || "—"}</td><td>{s.enrollmentCount}</td>
                  <td><Badge tone={s.isActive ? "success" : "muted"}>{s.isActive ? "active" : "inactive"}</Badge></td>
                  <td className="row-actions"><Button size="sm" variant="ghost" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)}>Edit</Button><Button size="sm" variant="ghost" aria-label={`Delete ${s.name}`} onClick={() => setDeleting(s)}>Delete</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={data?.meta} onPage={setPage} />
      {editing && <StudentForm student={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {deleting && <ConfirmDialog title="Delete student" message={`Delete ${deleting.name} and all of their progress, quiz attempts and messages? This cannot be undone.`} busy={busy} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}
    </>
  );
}
