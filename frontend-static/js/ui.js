// ui.js — shared chrome: navbar, theme toggle, mobile menu, toasts.
// renderHeader() runs on every page (called from main.js) so navigation
// always reflects the current login state (task 4: dynamic navigation).
import { store } from './state.js';
import { logout } from './auth.js';

function navLinks(user) {
  if (!user) return [['index.html', 'Home'], ['register.html', 'Register'], ['login.html', 'Log in']];
  const base = [['dashboard.html', 'Dashboard'], ['index.html', 'Courses']];
  return base;
}

export function renderHeader(activePage) {
  const user = store.get('user');
  const nav = document.getElementById('mainNav');
  const tools = document.getElementById('navTools');
  if (!nav || !tools) return;

  nav.innerHTML = navLinks(user)
    .map(([href, label]) => `<a href="${href}" ${href === activePage ? 'aria-current="page"' : ''}>${label}</a>`)
    .join('');

  if (user) {
    tools.innerHTML = `
      <span class="avatar hide-sm" title="${escapeHtml(user.name)}">${escapeHtml(user.name.trim()[0].toUpperCase())}</span>
      <button class="btn ghost small" id="logoutBtn">Log out</button>`;
    document.getElementById('logoutBtn').addEventListener('click', () => {
      logout();
      toast('You are logged out.');
      location.href = 'index.html';
    });
  } else {
    tools.innerHTML = `
      <a class="btn ghost small hide-sm" href="login.html">Log in</a>
      <a class="btn primary small" href="register.html">Register</a>`;
  }

  const menuBtn = document.getElementById('menuToggle');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function toast(text) {
  let host = document.querySelector('.toasts');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toasts';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  host.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

export function initTheme() {
  const saved = store.get('theme');
  if (saved === 'dark') document.documentElement.dataset.theme = 'dark';
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set({ theme: next });
  });
}
