import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, ErrorBanner, Field } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useDocumentTitle } from "../hooks.js";

export default function Login() {
  useDocumentTitle("Sign in");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(form.email.trim(), form.password);
      navigate(location.state?.from ?? (user.role === "admin" ? "/admin" : "/dashboard"), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to continue learning.</p>
        <ErrorBanner error={error} />
        <Field label="Email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Field label="Password" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Button type="submit" loading={busy} disabled={!form.email || !form.password}>Sign in</Button>
        <p className="muted center">New here? <Link to="/register">Create an account</Link></p>
      </form>
    </div>
  );
}
