import { useState } from "react";
import { Button, ErrorBanner, Field, Notice, PageHeader } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useDocumentTitle } from "../hooks.js";
import { TOKEN_KEY, fieldErrors, post, put } from "../lib/api.js";

export default function Profile() {
  useDocumentTitle("Profile");
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: user.name, department: user.department ?? "", weeklyHours: user.weeklyHours ?? 6 });
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [pwStatus, setPwStatus] = useState(null);
  const [pwError, setPwError] = useState(null);
  const [pwErrors, setPwErrors] = useState({});
  const [pwBusy, setPwBusy] = useState(false);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    setStatus(null);
    try {
      const body = await put("/profile", { name: form.name.trim(), department: form.department.trim(), weeklyHours: Number(form.weeklyHours) });
      setUser(body.data.user);
      setStatus("Profile saved.");
    } catch (err) {
      setError(err);
      setErrors(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setPwBusy(true);
    setPwError(null);
    setPwErrors({});
    setPwStatus(null);
    try {
      const body = await post("/auth/change-password", pw);
      localStorage.setItem(TOKEN_KEY, body.data.token); // older tokens are now revoked
      setPw({ currentPassword: "", newPassword: "" });
      setPwStatus("Password changed. Your other sessions have been signed out.");
    } catch (err) {
      setPwError(err);
      setPwErrors(fieldErrors(err));
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Your profile" subtitle={`${user.email} · ${user.role}`} />
      <div className="grid grid-2">
        <form className="card form" onSubmit={save} noValidate>
          <h2>Details</h2>
          {status && <Notice tone="success">{status}</Notice>}
          <ErrorBanner error={error && !Object.keys(errors).length ? error : null} />
          <Field label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
          <Field label="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} error={errors.department} />
          <Field label="Study hours per week" type="number" min="1" max="80" hint="Your study plan is sized to this budget." value={form.weeklyHours} onChange={(e) => setForm({ ...form, weeklyHours: e.target.value })} error={errors.weeklyHours} />
          <Button type="submit" loading={busy}>Save changes</Button>
        </form>

        <form className="card form" onSubmit={changePassword} noValidate>
          <h2>Change password</h2>
          {pwStatus && <Notice tone="success">{pwStatus}</Notice>}
          <ErrorBanner error={pwError && !Object.keys(pwErrors).length ? pwError : null} />
          <Field label="Current password" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} error={pwErrors.currentPassword} />
          <Field label="New password" type="password" autoComplete="new-password" hint="At least 12 characters." value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} error={pwErrors.newPassword} />
          <Button type="submit" loading={pwBusy} disabled={!pw.currentPassword || !pw.newPassword}>Update password</Button>
        </form>
      </div>
    </>
  );
}
