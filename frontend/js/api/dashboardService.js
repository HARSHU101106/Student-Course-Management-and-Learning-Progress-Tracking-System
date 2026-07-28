/* ============================================================
   dashboardService.js
   ============================================================ */
const DashboardService = {
  async studentSummary() {
    return apiClient.get('/dashboard/student');
  },
  async adminSummary() {
    return apiClient.get('/dashboard/admin');
  },
};
window.DashboardService = DashboardService;
