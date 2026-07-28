/* ============================================================
   register.js
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const form = Helpers.qs('#register-form');
  const submitBtn = Helpers.qs('#register-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: Helpers.qs('#name').value.trim(),
      email: Helpers.qs('#email').value.trim(),
      password: Helpers.qs('#password').value,
      confirmPassword: Helpers.qs('#confirm-password').value,
    };

    if (payload.password !== payload.confirmPassword) {
      Toast.error('Passwords do not match.');
      return;
    }
    if (payload.password.length < 8) {
      Toast.error('Password must be at least 8 characters.');
      return;
    }

    Helpers.setLoading(submitBtn, true, 'Creating account…');
    try {
      await AuthService.register(payload);
      Toast.success('Account created! Please sign in.');
      setTimeout(() => { window.location.href = 'login.html'; }, 900);
    } catch (err) {
      /* handled globally */
    } finally {
      Helpers.setLoading(submitBtn, false);
    }
  });
});
