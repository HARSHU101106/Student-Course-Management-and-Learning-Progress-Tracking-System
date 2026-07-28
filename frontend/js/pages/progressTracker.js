/* ============================================================
   progressTracker.js
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  if (!AuthUtil.guardPage()) return;

  const courseId = new URLSearchParams(window.location.search).get('courseId');

  document.addEventListener('edutrack:progress-updated', (e) => {
    if (!courseId || e.detail.courseId === courseId) loadProgress(courseId);
  });

  await loadProgress(courseId);
});

async function loadProgress(courseId) {
  try {
    const data = courseId ? await ProgressService.getForCourse(courseId) : await ProgressService.getOverview();
    renderRing(data.overallPercent ?? 0);
    renderMilestones(data.milestones || []);
    renderCourseRows(data.courses || []);
  } catch (err) {
    /* handled globally */
  }
}

function renderRing(pct) {
  const ring = Helpers.qs('#progress-ring');
  if (!ring) return;
  ring.style.setProperty('--pct', pct);
  Helpers.qs('#progress-ring-value').textContent = `${pct}%`;
}

function renderMilestones(milestones) {
  const wrap = Helpers.qs('#milestone-list');
  if (!wrap) return;
  wrap.innerHTML = milestones.map((m, i) => `
    <div class="milestone ${m.complete ? 'complete' : (m.current ? 'current' : '')}">
      <div class="dot">${m.complete ? '✓' : i + 1}</div>
      <div>
        <h4 style="margin-bottom:2px">${Helpers.escapeHtml(m.title)}</h4>
        <p class="text-sm" style="margin:0">${Helpers.escapeHtml(m.description || '')}</p>
      </div>
    </div>
  `).join('');
}

function renderCourseRows(courses) {
  const wrap = Helpers.qs('#course-progress-rows');
  if (!wrap) return;
  wrap.innerHTML = courses.map(c => `
    <div class="course-progress-row">
      <span>${Helpers.escapeHtml(c.title)}</span>
      <div class="progress-track" style="--pct:${c.percentComplete}"></div>
      <span class="mono text-sm">${c.percentComplete}%</span>
    </div>
  `).join('');
}
