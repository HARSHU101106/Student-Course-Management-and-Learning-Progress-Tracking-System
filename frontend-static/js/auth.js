// auth.js — login/logout/register + a guard for pages that require a session.
import { store } from './state.js';
import { apiLogin, apiRegister } from './api.js';

export function isLoggedIn() {
  return !!store.get('user');
}

export async function login(email, password) {
  const user = await apiLogin(email, password);
  store.set({ user });
  return user;
}

export async function register(fields) {
  const user = await apiRegister(fields);
  store.set({ user });
  return user;
}

export function logout() {
  store.set({ user: null });
}

// Call at the top of any page that requires a logged-in student/admin.
// Redirects to login.html if there is no session.
export function requireAuth({ role } = {}) {
  const user = store.get('user');
  if (!user) {
    location.href = 'login.html';
    return null;
  }
  if (role && user.role !== role) {
    location.href = user.role === 'admin' ? 'dashboard.html' : 'dashboard.html';
    return null;
  }
  return user;
}
