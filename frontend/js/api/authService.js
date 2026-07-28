/* ============================================================
   authService.js
   ============================================================ */
const AuthService = {
  async login(email, password) {
    const data = await apiClient.post('/auth/login', { email, password });
    AuthUtil.setSession(data.token, data.user);
    return data;
  },
  async register(payload) {
    return apiClient.post('/auth/register', payload);
  },
  async me() {
    return apiClient.get('/auth/me');
  },
  async forgotPassword(email) {
    return apiClient.post('/auth/forgot-password', { email });
  },
  logout() {
    AuthUtil.clearSession();
    window.location.href = 'login.html';
  },
};
window.AuthService = AuthService;
