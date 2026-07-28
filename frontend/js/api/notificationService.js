/* ============================================================
   notificationService.js
   ============================================================ */
const NotificationService = {
  async list(params = {}) {
    return apiClient.get('/notifications', { params });
  },
  async markRead(notificationId) {
    return apiClient.patch(`/notifications/${notificationId}/read`);
  },
  async markAllRead() {
    return apiClient.patch('/notifications/read-all');
  },
};
window.NotificationService = NotificationService;
