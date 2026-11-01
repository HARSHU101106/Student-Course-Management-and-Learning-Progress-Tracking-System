import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, ErrorBanner, Field } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useDocumentTitle } from "../hooks.js";
import { fieldErrors } from "../lib/api.js";

export default function Register() {
  useDocumentTitle("Create account");
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", department: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  function validate() {
    const next = {};
    if (form.name.trim().length < 2) next.name = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (form.password.length < 12) next.password = "Use at least 12 characters.";
    if (form.confirm !== form.password) next.confirm = "Passwords do not match.";
    return next;
  }

  async function submit(event) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setError(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password, ...(form.department.trim() && { department: form.department.trim() }) });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h1>Create your account</h1>
        <p className="muted">Join to enrol in courses, take quizzes and chat with classmates.</p>
        <ErrorBanner error={error && !Object.keys(errors).length ? error : null} />
        <Field label="Full name" autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} />
        <Field label="Email" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} />
        <Field label="Department (optional)" value={form.department} onChange={set("department")} error={errors.department} />
        <Field label="Password" type="password" autoComplete="new-password" hint="At least 12 characters." value={form.password} onChange={set("password")} error={errors.password} />
        <Field label="Confirm password" type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} error={errors.confirm} />
        <Button type="submit" loading={busy}>Create account</Button>
        <p className="muted center">Already registered? <Link to="/login">Sign in</Link></p>
      </form>
    </div>
  );
}
