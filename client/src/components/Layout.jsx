import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useRealtime } from "../context/RealtimeContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";

function NotificationBell() {
  const { unread } = useRealtime();
  return (
    <NavLink to="/notifications" className="nav-link bell" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {unread > 0 && <span className="bell-count" data-testid="unread-count">{unread > 99 ? "99+" : unread}</span>}
    </NavLink>
  );
}

function Toasts() {
  const { toasts, dismissToast } = useRealtime();
  const navigate = useNavigate();
  return (
    <div className="toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast" role="status">
          <div>
            <strong>{toast.title}</strong>
            {toast.body && <p>{toast.body}</p>}
          </div>
          <div className="toast-actions">
            {toast.link && (
              <button className="link-btn" onClick={() => { dismissToast(toast.id); navigate(toast.link); }}>View</button>
            )}
            <button className="icon-btn" aria-label="Dismiss notification" onClick={() => dismissToast(toast.id)}>×</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const { connected } = useRealtime();
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const close = () => setOpen(false);
  const signOut = () => {
    logout();
    close();
    navigate("/");
  };

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="container nav">
          <Link to="/" className="brand" onClick={close}>
            <span className="brand-mark" aria-hidden="true">A</span>
            <span>AdaptLearn</span>
          </Link>
          <button className="icon-btn nav-toggle" aria-expanded={open} aria-controls="primary-nav" aria-label="Toggle menu" onClick={() => setOpen((v) => !v)}>
            ☰
          </button>
          <nav id="primary-nav" className={`nav-links ${open ? "open" : ""}`} aria-label="Primary">
            <NavLink to="/courses" className="nav-link" onClick={close}>{isAdmin ? "Catalog" : "Courses"}</NavLink>
            {user && !isAdmin && <NavLink to="/dashboard" className="nav-link" onClick={close}>Dashboard</NavLink>}
            {user && <NavLink to="/chat" className="nav-link" onClick={close}>Chat</NavLink>}
            {isAdmin && (
              <>
                <NavLink to="/admin" end className="nav-link" onClick={close}>Overview</NavLink>
                <NavLink to="/admin/courses" className="nav-link" onClick={close}>Courses</NavLink>
                <NavLink to="/admin/students" className="nav-link" onClick={close}>Students</NavLink>
                <NavLink to="/admin/studio" className="nav-link" onClick={close}>Studio</NavLink>
              </>
            )}
            <span className="nav-spacer" />
            <button className="nav-link icon-text" onClick={toggle} aria-pressed={dark} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
              {dark ? "☀ Light" : "☾ Dark"}
            </button>
            {user ? (
              <>
                <NotificationBell />
                <NavLink to="/profile" className="nav-link user-chip" onClick={close}>
                  <span className={`dot ${connected ? "dot-on" : "dot-off"}`} title={connected ? "Live updates connected" : "Reconnecting…"} aria-hidden="true" />
                  {user.name.split(" ")[0]}
                </NavLink>
                <button className="nav-link" onClick={signOut}>Sign out</button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="nav-link" onClick={close}>Sign in</NavLink>
                <Link to="/register" className="btn btn-accent btn-sm" onClick={close}>Get started</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main" className="container main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container">AdaptLearn · Student course management and learning portal</div>
      </footer>
      <Toasts />
    </>
  );
}
