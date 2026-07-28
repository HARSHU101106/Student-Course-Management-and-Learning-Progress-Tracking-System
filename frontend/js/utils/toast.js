/* ============================================================
   toast.js — lightweight toast notifications (no dependency)
   ============================================================ */
const Toast = {
  _container() {
    let el = document.querySelector('.toast-container');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast-container';
      document.body.appendChild(el);
    }
    return el;
  },
  show(message, type = 'info', duration = 3500) {
    const container = this._container();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('closing');
      setTimeout(() => toast.remove(), 200);
    }, duration);
  },
  success(msg, duration) { this.show(msg, 'success', duration); },
  error(msg, duration) { this.show(msg, 'error', duration); },
  info(msg, duration) { this.show(msg, 'info', duration); },
};
window.Toast = Toast;
