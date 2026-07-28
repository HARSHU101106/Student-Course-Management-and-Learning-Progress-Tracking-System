/* ============================================================
   auth.js — session/token handling (localStorage-backed)
   ============================================================ */
const AuthUtil = {
  TOKEN_KEY: 'edutrack_token',
  USER_KEY: 'edutrack_user',

  setSession(token, user) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },
  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },
  getUser() {
    const raw = localStorage.getItem(this.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  isAuthenticated() {
    return !!this.getToken();
  },
  hasRole(role) {
    const user = this.getUser();
    return !!user && user.role === role;
  },
  clearSession() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  },
  /** Call at the top of any protected page. Redirects if not authenticated,
   *  or to an "unauthorized" experience if requiredRole doesn't match. */
  guardPage(requiredRole) {
    if (!this.isAuthenticated()) {
      window.location.href = 'login.html';
      return false;
    }
    if (requiredRole && !this.hasRole(requiredRole)) {
      window.location.href = 'student-dashboard.html';
      return false;
    }
    return true;
  },
};
window.AuthUtil = AuthUtil;
