import { useNavigate } from "react-router-dom";
import { Button, EmptyState, PageHeader } from "../components/ui.jsx";
import { useRealtime } from "../context/RealtimeContext.jsx";
import { useDocumentTitle } from "../hooks.js";
import { timeAgo } from "../lib/format.js";

export default function Notifications() {
  useDocumentTitle("Notifications");
  const { notifications, unread, markRead, markAllRead, remove } = useRealtime();
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : "You are all caught up."}
        actions={unread > 0 && <Button variant="secondary" onClick={markAllRead}>Mark all as read</Button>}
      />
      {notifications.length === 0 ? (
        <EmptyState title="No notifications yet">Enrolments, quiz results, announcements and messages will show up here as they happen.</EmptyState>
      ) : (
        <ul className="list">
          {notifications.map((item) => (
            <li key={item.id} className={`card notification ${item.read ? "" : "unread"}`}>
              <div>
                <p><strong>{item.title}</strong></p>
                {item.body && <p className="muted">{item.body}</p>}
                <p className="muted small"><time dateTime={item.createdAt}>{timeAgo(item.updatedAt ?? item.createdAt)}</time></p>
              </div>
              <div className="row-actions">
                {item.link && (
                  <Button size="sm" variant="secondary" onClick={() => { markRead(item.id); navigate(item.link); }}>Open</Button>
                )}
                {!item.read && <Button size="sm" variant="ghost" onClick={() => markRead(item.id)}>Mark read</Button>}
                <Button size="sm" variant="ghost" aria-label={`Delete notification: ${item.title}`} onClick={() => remove(item.id)}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
