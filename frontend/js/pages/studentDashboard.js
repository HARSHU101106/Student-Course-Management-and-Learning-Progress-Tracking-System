/* ============================================================
   studentDashboard.js
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  if (!AuthUtil.guardPage()) return;
  SocketClient.init();

  const user = AuthUtil.getUser();
  Helpers.qs('#welcome-name').textContent = user.name.split(' ')[0];

  try {
    const summary = await DashboardService.studentSummary();
    renderStats(summary.stats);
    renderContinueLearning(summary.inProgressCourses || []);
    renderRecentNotifications(summary.recentNotifications || []);
  } catch (err) {
    /* handled globally */
  }
});

function renderStats(stats = {}) {
  const map = {
    '#stat-enrolled': stats.enrolledCount ?? 0,
    '#stat-completed': stats.completedCount ?? 0,
    '#stat-hours': stats.hoursLearned ?? 0,
    '#stat-streak': stats.streakDays ?? 0,
  };
  Object.entries(map).forEach(([sel, val]) => {
    const el = Helpers.qs(sel);
    if (el) el.textContent = val;
  });
}

function renderContinueLearning(courses) {
  const wrap = Helpers.qs('#continue-learning-list');
  if (!wrap) return;
  if (!courses.length) {
    wrap.innerHTML = `<div class="empty-state"><p>No courses in progress yet. Explore the catalogue to get started.</p><a class="btn btn-primary" href="courses.html">Browse courses</a></div>`;
    return;
  }
  wrap.innerHTML = courses.map(c => `
    <div class="card course-progress-row">
      <div>
        <h4 style="margin-bottom:4px">${Helpers.escapeHtml(c.title)}</h4>
        <span class="text-sm text-muted">${Helpers.escapeHtml(c.instructor || '')}</span>
      </div>
      <div class="progress-track" style="--pct:${c.percentComplete}"></div>
      <a class="btn btn-gold btn-sm" href="course-details.html?id=${c._id}">Resume</a>
    </div>
  `).join('');
}

function renderRecentNotifications(items) {
  const wrap = Helpers.qs('#recent-notifications');
  if (!wrap) return;
  wrap.innerHTML = items.length
    ? items.map(n => `
        <div class="notification-item ${n.read ? '' : 'unread'}">
          <div class="icon-wrap">🔔</div>
          <div>
            <p style="margin:0;color:var(--color-navy)">${Helpers.escapeHtml(n.message)}</p>
            <span class="text-sm text-muted">${Helpers.timeAgo(n.createdAt)}</span>
          </div>
        </div>`).join('')
    : `<p class="text-muted text-sm">You're all caught up.</p>`;
}
