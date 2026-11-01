import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SOCKET_URL, TOKEN_KEY, del, get, patch } from "../lib/api.js";
import { useAuth } from "./AuthContext.jsx";

const RealtimeContext = createContext(null);
const TOAST_MS = 6000;

/**
 * Owns the single Socket.IO connection and the notification list.
 * The socket authenticates with the same JWT as the REST API and is torn down on logout.
 */
export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const pushToast = useCallback((toast) => {
    const id = ++toastId.current;
    setToasts((current) => [...current.slice(-3), { id, tone: "info", ...toast }]);
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), TOAST_MS);
  }, []);
  const dismissToast = useCallback((id) => setToasts((current) => current.filter((item) => item.id !== id)), []);

  const loadNotifications = useCallback(async () => {
    const body = await get("/notifications", { limit: 30 });
    setNotifications(body.data);
    setUnread(body.meta.unreadCount);
  }, []);

  useEffect(() => {
    if (!user) {
      setSocket(null);
      setConnected(false);
      setNotifications([]);
      setUnread(0);
      return undefined;
    }

    loadNotifications().catch(() => {});

    const client = io(SOCKET_URL, {
      auth: { token: localStorage.getItem(TOKEN_KEY) },
      transports: ["websocket", "polling"],
      reconnectionDelayMax: 8000,
    });
    setSocket(client);

    client.on("connect", () => setConnected(true));
    client.on("disconnect", () => setConnected(false));
    client.on("connect_error", (error) => {
      setConnected(false);
      if (error?.data?.code === "UNAUTHORIZED") window.dispatchEvent(new Event("auth:expired"));
    });
    client.on("notification:new", (notification) => {
      setNotifications((current) => [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 50));
      // Coalesced notifications update in place; only count as unread if it was not already.
      setUnread((count) => count + 1);
      pushToast({ title: notification.title, body: notification.body, link: notification.link });
      // The count above can drift when a coalesced notification updates; re-sync cheaply.
      get("/notifications", { limit: 1 })
        .then((body) => setUnread(body.meta.unreadCount))
        .catch(() => {});
    });

    return () => {
      client.removeAllListeners();
      client.close();
    };
  }, [user, loadNotifications, pushToast]);

  const markRead = useCallback(async (id) => {
    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
    setUnread((count) => Math.max(0, count - 1));
    await patch(`/notifications/${id}/read`).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    setUnread(0);
    await patch("/notifications/read-all").catch(() => {});
  }, []);

  const remove = useCallback(
    async (id) => {
      setNotifications((current) => current.filter((item) => item.id !== id));
      await del(`/notifications/${id}`).catch(() => {});
      get("/notifications", { limit: 1 }).then((body) => setUnread(body.meta.unreadCount)).catch(() => {});
    },
    [],
  );

  const value = useMemo(
    () => ({ socket, connected, notifications, unread, toasts, pushToast, dismissToast, markRead, markAllRead, remove, reload: loadNotifications }),
    [socket, connected, notifications, unread, toasts, pushToast, dismissToast, markRead, markAllRead, remove, loadNotifications],
  );
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error("useRealtime must be used inside <RealtimeProvider>");
  return context;
}
