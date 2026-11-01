import { useEffect, useId, useRef } from "react";

export function Button({ variant = "primary", size, loading, children, className = "", ...props }) {
  const classes = ["btn", `btn-${variant}`, size ? `btn-${size}` : "", className].filter(Boolean).join(" ");
  return (
    <button className={classes} disabled={loading || props.disabled} aria-busy={loading || undefined} {...props}>
      {loading && <span className="spinner spinner-sm" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Field({ label, error, hint, children, as: Control = "input", ...props }) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children ? (
        children({ id, "aria-invalid": Boolean(error) || undefined, "aria-describedby": describedBy })
      ) : (
        <Control id={id} aria-invalid={Boolean(error) || undefined} aria-describedby={describedBy} {...props} />
      )}
      {hint && !error && <p id={`${id}-hint`} className="field-hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export function Spinner({ label = "Loading" }) {
  return (
    <div className="center-block" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}

export function ErrorBanner({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="banner banner-error" role="alert">
      <span>{error.message ?? String(error)}</span>
      {onRetry && <Button variant="ghost" size="sm" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function Notice({ tone = "info", children }) {
  return <div className={`banner banner-${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Badge({ tone = "neutral", children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function ProgressBar({ value, label }) {
  const percent = Math.max(0, Math.min(100, Math.round(value ?? 0)));
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={label ?? "Progress"}>
      <div className="progress-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <Button variant="secondary" size="sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</Button>
      <span aria-live="polite">Page {meta.page} of {meta.pages}</span>
      <Button variant="secondary" size="sm" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>Next</Button>
    </nav>
  );
}

/** Accessible modal: traps nothing fancy but closes on Escape/backdrop and restores focus. */
export function Modal({ title, onClose, children, wide }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    const onKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = "Delete", onConfirm, onCancel, busy }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p>{message}</p>
      <div className="form-actions">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="danger" loading={busy} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
