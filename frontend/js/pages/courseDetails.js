/* ============================================================
   courseDetails.js
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  if (!AuthUtil.guardPage()) return;

  const courseId = new URLSearchParams(window.location.search).get('id');
  if (!courseId) { window.location.href = 'courses.html'; return; }

  try {
    const course = await CourseService.getById(courseId);
    renderCourse(course);
    wireEnrollButton(course);
    wireTabs();
  } catch (err) {
    /* handled globally */
  }
});

function renderCourse(course) {
  Helpers.qs('#course-title').textContent = course.title;
  Helpers.qs('#course-description').textContent = course.description;
  Helpers.qs('#course-instructor').textContent = course.instructor || 'EduTrack Faculty';
  Helpers.qs('#course-duration').textContent = `${course.durationHours || 0}h`;
  Helpers.qs('#course-level').textContent = course.level || 'All levels';

  const list = Helpers.qs('#curriculum-list');
  list.innerHTML = (course.lessons || []).map((l, i) => `
    <div class="curriculum-item ${l.completed ? 'done' : ''}">
      <div class="flex items-center gap-3">
        <span class="lesson-icon">${l.completed ? '✓' : i + 1}</span>
        <span>${Helpers.escapeHtml(l.title)}</span>
      </div>
      <span class="text-sm text-muted">${l.durationMinutes || 0} min</span>
    </div>
  `).join('');
}

function wireEnrollButton(course) {
  const btn = Helpers.qs('#enroll-btn');
  if (!btn) return;
  if (course.isEnrolled) {
    btn.textContent = 'Continue learning';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-gold');
  }
  btn.addEventListener('click', async () => {
    if (course.isEnrolled) {
      window.location.href = `progress.html?courseId=${course._id}`;
      return;
    }
    Helpers.setLoading(btn, true, 'Enrolling…');
    try {
      await EnrollmentService.enroll(course._id);
      Toast.success('Enrolled! Happy learning.');
      setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      Helpers.setLoading(btn, false);
    }
  });
}

function wireTabs() {
  Helpers.qsa('.tab-bar .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      Helpers.qsa('.tab-bar .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      Helpers.qsa('.tab-panel').forEach(p => p.classList.add('hidden'));
      Helpers.qs(`#panel-${tab.dataset.tab}`).classList.remove('hidden');
    });
  });
}
