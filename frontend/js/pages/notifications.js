/* ============================================================
   notifications.js
   ============================================================ */
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  if (!AuthUtil.guardPage()) return;

  Helpers.qsa('.notif-filter-tabs .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      Helpers.qsa('.notif-filter-tabs .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      loadNotifications();
    });
  });

  Helpers.qs('#mark-all-read')?.addEventListener('click', async () => {
    await NotificationService.markAllRead();
    Toast.success('All notifications marked as read.');
    loadNotifications();
  });

  document.addEventListener('edutrack:notification', () => loadNotifications());

  await loadNotifications();
});

async function loadNotifications() {
  try {
    const params = currentFilter === 'unread' ? { unread: true } : {};
    const items = (await NotificationService.list(params)).notifications || [];
    renderNotifications(items);
  } catch (err) {
    /* handled globally */
  }
}

function renderNotifications(items) {
  const wrap = Helpers.qs('#notification-list');
  if (!items.length) {
    wrap.innerHTML = `<div class="empty-state"><p>Nothing here yet.</p></div>`;
    return;
  }
  wrap.innerHTML = items.map(n => `
    <div class="notification-item ${n.read ? '' : 'unread'}" data-id="${n._id}">
      <div class="icon-wrap">🔔</div>
      <div class="flex-1">
        <p style="margin:0;color:var(--color-navy)">${Helpers.escapeHtml(n.message)}</p>
        <span class="text-sm text-muted">${Helpers.timeAgo(n.createdAt)}</span>
      </div>
      ${n.read ? '' : `<button class="btn btn-ghost btn-sm" onclick="markOneRead('${n._id}')">Mark read</button>`}
    </div>
  `).join('');
}

async function markOneRead(id) {
  await NotificationService.markRead(id);
  loadNotifications();
}
