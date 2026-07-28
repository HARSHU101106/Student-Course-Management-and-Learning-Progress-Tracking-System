/* ============================================================
   courseList.js
   ============================================================ */
let allCourses = [];
let activeCategory = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  if (!AuthUtil.guardPage()) return;

  const searchInput = Helpers.qs('#course-search');
  searchInput.addEventListener('input', Helpers.debounce(() => renderCourses(), 250));

  Helpers.qsa('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      Helpers.qsa('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeCategory = chip.dataset.category;
      renderCourses();
    });
  });

  try {
    allCourses = (await CourseService.list()).courses || [];
    renderCourses();
  } catch (err) {
    /* handled globally */
  }
});

function renderCourses() {
  const grid = Helpers.qs('#course-grid');
  const query = Helpers.qs('#course-search').value.trim().toLowerCase();

  const filtered = allCourses.filter(c => {
    const matchesCategory = activeCategory === 'all' || c.category === activeCategory;
    const matchesQuery = !query || c.title.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state"><p>No courses match your search.</p></div>`;
    return;
  }

  grid.innerHTML = filtered.map(c => `
    <div class="card course-card">
      <div class="thumb">${Helpers.escapeHtml((c.title || '?').charAt(0))}</div>
      <span class="badge badge-info">${Helpers.escapeHtml(c.category || 'General')}</span>
      <h4>${Helpers.escapeHtml(c.title)}</h4>
      <p class="text-sm">${Helpers.escapeHtml(c.shortDescription || '')}</p>
      <div class="meta">
        <span>⏱ ${c.durationHours || 0}h</span>
        <span>👥 ${c.enrolledCount || 0} enrolled</span>
      </div>
      <a class="btn btn-primary btn-block" href="course-details.html?id=${c._id}">View course</a>
    </div>
  `).join('');
}
