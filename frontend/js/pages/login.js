/* ============================================================
   login.js
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  if (AuthUtil.isAuthenticated()) {
    window.location.href = AuthUtil.hasRole('admin') ? 'admin-dashboard.html' : 'student-dashboard.html';
    return;
  }

  const form = Helpers.qs('#login-form');
  const submitBtn = Helpers.qs('#login-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = Helpers.qs('#email').value.trim();
    const password = Helpers.qs('#password').value;

    if (!email || !password) {
      Toast.error('Enter your email and password to continue.');
      return;
    }

    Helpers.setLoading(submitBtn, true, 'Signing in…');
    try {
      const data = await AuthService.login(email, password);
      Toast.success(`Welcome back, ${data.user.name.split(' ')[0]}!`);
      setTimeout(() => {
        window.location.href = data.user.role === 'admin' ? 'admin-dashboard.html' : 'student-dashboard.html';
      }, 600);
    } catch (err) {
      /* error toast already shown by axiosClient interceptor */
    } finally {
      Helpers.setLoading(submitBtn, false);
    }
  });
});
