/* ============================================================
   axiosClient.js — central HTTP client (axios via CDN global)
   Attaches auth token, base URL, and global error handling.
   ============================================================ */
(function () {
  const BASE_URL = window.EDUTRACK_API_BASE || 'http://localhost:5000/api';

  const client = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });

  // Attach token on every request
  client.interceptors.request.use((config) => {
    const token = AuthUtil.getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  // Global response/error handling
  client.interceptors.response.use(
    (response) => response.data,
    (error) => {
      const status = error.response ? error.response.status : null;
      const message = (error.response && error.response.data && error.response.data.message)
        || error.message || 'Something went wrong. Please try again.';

      if (status === 401) {
        AuthUtil.clearSession();
        Toast.show('Your session expired. Please sign in again.', 'error');
        setTimeout(() => { window.location.href = 'login.html'; }, 1200);
      } else {
        Toast.show(message, 'error');
      }
      return Promise.reject(error);
    }
  );

  window.apiClient = client;
})();
