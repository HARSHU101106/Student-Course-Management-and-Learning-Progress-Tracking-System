// state.js — a small central store for session, enrollment and UI state.
// Other modules import { store } and either read store.state directly
// or call store.set(...) so every part of the app stays in sync.

const KEY = 'adaptlearn_state_v1';

const defaults = {
  user: null,               // { name, email, role, dept } | null
  theme: 'light',           // 'light' | 'dark'
  enrolled: {                // courseId -> { progress, last }
    dbms: { progress: 0.62, last: 'dbms-5' }
  },
  watched: {},               // lessonId -> fraction watched (0-1)
  notifications: [
    { id: 1, text: 'Your study plan for this week is ready.', read: false, ago: '2 h ago' },
    { id: 2, text: 'New course added: Operating Systems.', read: true, ago: '2 days ago' }
  ]
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(defaults);
    return { ...structuredClone(defaults), ...JSON.parse(raw) };
  } catch (e) {
    return structuredClone(defaults);
  }
}

function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
}

class Store {
  constructor() {
    this.state = load();
    this.listeners = new Set();
  }
  get(path) {
    return path.split('.').reduce((v, k) => (v == null ? v : v[k]), this.state);
  }
  set(patch) {
    this.state = { ...this.state, ...patch };
    save(this.state);
    this.listeners.forEach((fn) => fn(this.state));
  }
  update(key, updater) {
    this.set({ [key]: updater(this.state[key]) });
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const store = new Store();
