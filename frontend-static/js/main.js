// main.js — runs on every page. Each HTML file sets
// <body data-page="index.html"> so this script knows which nav link to
// mark active, then wires up the shared header/theme/menu.
import { initTheme, renderHeader } from './ui.js';

function boot() {
  initTheme();
  renderHeader(document.body.dataset.page || 'index.html');
}

// Module scripts normally run after parsing but before DOMContentLoaded,
// so the listener below is enough in almost every case. The readyState
// check is a defensive fallback for the rare case where this script runs
// (or is injected) after that point, so the header never fails to render.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
