/* ============================================================
   adminDashboard.js
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  if (!AuthUtil.guardPage('admin')) return;

  try {
    const summary = await DashboardService.adminSummary();
    renderAdminStats(summary.stats);
    renderRecentEnrollments(summary.recentEnrollments || []);
  } catch (err) {
    /* handled globally */
  }
});

function renderAdminStats(stats = {}) {
  const map = {
    '#stat-total-students': stats.totalStudents ?? 0,
    '#stat-total-courses': stats.totalCourses ?? 0,
    '#stat-active-enrollments': stats.activeEnrollments ?? 0,
    '#stat-completion-rate': `${stats.completionRate ?? 0}%`,
  };
  Object.entries(map).forEach(([sel, val]) => {
    const el = Helpers.qs(sel);
    if (el) el.textContent = val;
  });
}

function renderRecentEnrollments(rows) {
  const tbody = Helpers.qs('#enrollments-tbody');
  if (!tbody) return;
  tbody.innerHTML = rows.length ? rows.map(r => `
    <tr>
      <td>${Helpers.escapeHtml(r.studentName)}</td>
      <td>${Helpers.escapeHtml(r.courseTitle)}</td>
      <td>${Helpers.formatDate(r.enrolledAt)}</td>
      <td><span class="badge badge-${r.status === 'active' ? 'success' : 'neutral'}">${r.status}</span></td>
    </tr>`).join('')
    : `<tr><td colspan="4" class="text-center text-muted">No enrollments yet.</td></tr>`;
}
