/* ============================================================
   enrollment.js — "my enrollments" page
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  if (!AuthUtil.guardPage()) return;

  try {
    const enrollments = (await EnrollmentService.myEnrollments()).enrollments || [];
    renderEnrollments(enrollments);
  } catch (err) {
    /* handled globally */
  }
});

function renderEnrollments(rows) {
  const wrap = Helpers.qs('#enrollment-list');
  if (!rows.length) {
    wrap.innerHTML = `<div class="empty-state"><p>You haven't enrolled in any course yet.</p><a class="btn btn-primary" href="courses.html">Browse the catalogue</a></div>`;
    return;
  }
  wrap.innerHTML = rows.map(r => `
    <div class="card flex justify-between items-center" style="margin-bottom:12px">
      <div>
        <h4 style="margin-bottom:4px">${Helpers.escapeHtml(r.course.title)}</h4>
        <span class="text-sm text-muted">Enrolled ${Helpers.formatDate(r.enrolledAt)}</span>
      </div>
      <div class="flex items-center gap-4">
        <div class="progress-track" style="width:160px;--pct:${r.percentComplete}"></div>
        <a class="btn btn-gold btn-sm" href="progress.html?courseId=${r.course._id}">View progress</a>
        <button class="btn btn-danger btn-sm" data-id="${r._id}" onclick="unenroll('${r._id}')">Unenroll</button>
      </div>
    </div>
  `).join('');
}

async function unenroll(enrollmentId) {
  if (!confirm('Unenroll from this course? Your progress will be kept if you rejoin later.')) return;
  try {
    await EnrollmentService.unenroll(enrollmentId);
    Toast.success('Unenrolled successfully.');
    const enrollments = (await EnrollmentService.myEnrollments()).enrollments || [];
    renderEnrollments(enrollments);
  } catch (err) {
    /* handled globally */
  }
}
