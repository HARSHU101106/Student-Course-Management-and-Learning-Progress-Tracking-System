import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowRight, ArrowLeft, Loader2, GraduationCap, CheckCircle2 } from "lucide-react";

/**
 * ForgotPassword.jsx
 * Password reset request for the Meridian course management system.
 * Theme: navy / gold / ivory (see tailwind.theme.js)
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      // Replace with real API call, e.g.:
      // const res = await fetch("/api/auth/forgot-password", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ email }),
      // });
      // if (!res.ok) throw new Error((await res.json()).message);
      await new Promise((r) => setTimeout(r, 900));
      setSent(true);
    } catch (err) {
      setError(err.message || "We couldn't send the reset link. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ivory">
      {/* Left — brand panel */}
      <aside className="hidden lg:flex flex-col justify-between bg-navy text-ivory px-14 py-12 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold-dark via-gold to-gold-light" />

        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-navy-light border border-gold/40 flex items-center justify-center">
            <GraduationCap size={18} className="text-gold-light" />
          </span>
          <span className="font-serif text-xl font-semibold tracking-tight">Meridian</span>
        </div>

        <div className="max-w-sm">
          <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-gold-light">
            Account recovery
          </span>
          <h1 className="font-serif text-4xl leading-tight mt-4 mb-5">
            Let's get you back in.
          </h1>
          <p className="text-slate-light text-[15px] leading-relaxed">
            Enter the email address on your account and we'll send a secure link to reset your password.
            Your enrollments and progress stay exactly where you left them.
          </p>
        </div>

        <div className="border-t border-white/10 pt-6 text-xs text-slate-light">
          Reset links expire after 30 minutes for your security.
        </div>
      </aside>

      {/* Right — form */}
      <main className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <span className="w-9 h-9 rounded-full bg-navy flex items-center justify-center">
              <GraduationCap size={18} className="text-gold-light" />
            </span>
            <span className="font-serif text-xl font-semibold text-navy">Meridian</span>
          </div>

          {!sent ? (
            <>
              <h2 className="font-serif text-2xl font-semibold text-navy mb-1">Reset your password</h2>
              <p className="text-slate text-sm mb-8">
                We'll email you a link to create a new one.
              </p>

              {error && (
                <div className="mb-5 rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-navy mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError("");
                      }}
                      placeholder="you@university.edu"
                      className={`w-full rounded-md border bg-white pl-10 pr-3.5 py-2.5 text-sm text-navy placeholder:text-slate/60
                        focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition
                        ${error ? "border-danger" : "border-slate-light"}`}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-navy text-ivory py-2.5 text-sm font-medium
                    hover:bg-navy-light active:bg-navy-dark transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Sending link…
                    </>
                  ) : (
                    <>
                      Send reset link <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div>
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-6">
                <CheckCircle2 size={22} className="text-success" />
              </div>
              <h2 className="font-serif text-2xl font-semibold text-navy mb-2">Check your inbox</h2>
              <p className="text-slate text-sm leading-relaxed mb-1">
                If an account exists for
              </p>
              <p className="text-navy text-sm font-medium mb-5">{email}</p>
              <p className="text-slate text-sm leading-relaxed mb-8">
                you'll receive a password reset link within a few minutes. The link stays active for 30 minutes.
              </p>

              <div className="rounded-md border border-slate-light bg-white px-4 py-3.5 text-sm text-slate mb-6">
                Didn't get anything?{" "}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="font-medium text-gold-dark hover:text-navy transition disabled:opacity-60"
                >
                  Resend link
                </button>
              </div>
            </div>
          )}

          <Link
            to="/login"
            className="mt-8 flex items-center gap-2 justify-center text-sm font-medium text-slate hover:text-navy transition"
          >
            <ArrowLeft size={15} /> Back to sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
