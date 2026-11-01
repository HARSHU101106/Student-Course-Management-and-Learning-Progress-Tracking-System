import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, ErrorBanner, Notice, Spinner } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useRealtime } from "../context/RealtimeContext.jsx";
import { useAsync, useDocumentTitle } from "../hooks.js";
import { get, post } from "../lib/api.js";
import { clock } from "../lib/format.js";

function ack(socket, event, payload) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: "The server did not respond." }), 6000);
    socket.emit(event, payload, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

export default function Chat() {
  useDocumentTitle("Chat");
  const { user } = useAuth();
  const { socket, connected, notifications, markRead } = useRealtime();
  const [params] = useSearchParams();
  const rooms = useAsync(() => get("/messages/rooms").then((b) => b.data), []);
  const contacts = useAsync(() => get("/messages/contacts").then((b) => b.data), []);

  const [active, setActive] = useState(null); // { kind: "course"|"dm", room?, userId?, title }
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(null);
  const lastTyping = useRef(0);
  const typingTimer = useRef(null);
  const bottom = useRef(null);

  const courseRooms = rooms.data?.courses ?? [];
  const threads = rooms.data?.direct ?? [];

  // Choose an initial conversation from the URL (?dm=<userId> or ?course=<courseId>) or the first course.
  useEffect(() => {
    if (active || !rooms.data || !contacts.data) return;
    const dm = params.get("dm");
    const course = params.get("course");
    if (dm) {
      const person = contacts.data.find((c) => c.id === dm) ?? threads.find((t) => t.partner.id === dm)?.partner;
      if (person) {
        setActive({ kind: "dm", userId: person.id, title: person.name });
        return;
      }
    }
    const target = courseRooms.find((r) => r.id === course) ?? courseRooms[0];
    if (target) setActive({ kind: "course", room: target.room, title: target.title });
  }, [rooms.data, contacts.data, active, params, courseRooms, threads]);

  // Load history and join the room whenever the conversation changes.
  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    setMessages([]);
    setError(null);
    setTyping(null);
    setLoadingMessages(true);
    const url = active.kind === "course" ? `/messages/rooms/${active.room}` : `/messages/dm/${active.userId}`;
    get(url, { limit: 60 })
      .then((body) => !cancelled && setMessages(body.data))
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoadingMessages(false));
    if (active.kind === "course" && socket) {
      ack(socket, "chat:join", { room: active.room }).then((res) => !res.ok && !cancelled && setError(new Error(res.error)));
    }
    return () => {
      cancelled = true;
      if (active.kind === "course" && socket) socket.emit("chat:leave", { room: active.room });
    };
  }, [active, socket]);

  const belongsToActive = useCallback(
    (message) => {
      if (!active) return false;
      if (active.kind === "course") return message.room === active.room;
      return message.sender.id === active.userId || message.to === active.userId;
    },
    [active],
  );

  // Live messages and typing indicators.
  useEffect(() => {
    if (!socket) return undefined;
    const onMessage = (message) => {
      if (belongsToActive(message)) {
        setMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));
        if (message.sender.id !== user.id) setTyping(null);
      }
      if (message.room.startsWith("dm:")) rooms.reload();
    };
    const onTyping = ({ room, user: who }) => {
      if (active?.kind === "course" && room === active.room && who.id !== user.id) {
        setTyping(who.name);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(null), 2500);
      }
    };
    socket.on("chat:message", onMessage);
    socket.on("chat:typing", onTyping);
    return () => {
      socket.off("chat:message", onMessage);
      socket.off("chat:typing", onTyping);
      clearTimeout(typingTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, active, belongsToActive, user.id]);

  // Opening a DM clears its unread message notification.
  useEffect(() => {
    if (active?.kind !== "dm") return;
    notifications.filter((n) => n.type === "message" && !n.read && n.meta?.from === active.userId).forEach((n) => markRead(n.id));
  }, [active, notifications, markRead]);

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: "end" });
  }, [messages, typing]);

  async function send(event) {
    event.preventDefault();
    const body = text.trim();
    if (!body || !active || sending) return;
    setSending(true);
    setError(null);
    const payload = active.kind === "course" ? { room: active.room, text: body } : { to: active.userId, text: body };
    try {
      if (socket && connected) {
        const response = await ack(socket, "chat:send", payload);
        if (!response.ok) throw new Error(response.error);
      } else {
        const res = await post("/messages", payload); // REST fallback when the socket is down
        setMessages((current) => (current.some((m) => m.id === res.data.message.id) ? current : [...current, res.data.message]));
      }
      setText("");
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
    }
  }

  function onType(value) {
    setText(value);
    if (active?.kind === "course" && socket && Date.now() - lastTyping.current > 1500) {
      lastTyping.current = Date.now();
      socket.emit("chat:typing", { room: active.room });
    }
  }

  const unreadFrom = useMemo(() => new Set(notifications.filter((n) => n.type === "message" && !n.read).map((n) => n.meta?.from)), [notifications]);
  const newContacts = (contacts.data ?? []).filter((c) => !threads.some((t) => t.partner.id === c.id));

  if (rooms.loading && !rooms.data) return <Spinner label="Loading chat" />;

  return (
    <div className="chat">
      <aside className="chat-side card" aria-label="Conversations">
        <h2>Course rooms</h2>
        {courseRooms.length === 0 && <p className="muted">Enrol in a course to join its chat.</p>}
        <ul className="chat-list">
          {courseRooms.map((room) => (
            <li key={room.room}>
              <button className={active?.room === room.room ? "chat-item active" : "chat-item"} onClick={() => setActive({ kind: "course", room: room.room, title: room.title })}>
                # {room.title}
              </button>
            </li>
          ))}
        </ul>
        <h2>Direct messages</h2>
        <ul className="chat-list">
          {threads.map((thread) => (
            <li key={thread.room}>
              <button className={active?.userId === thread.partner.id ? "chat-item active" : "chat-item"} onClick={() => setActive({ kind: "dm", userId: thread.partner.id, title: thread.partner.name })}>
                {thread.partner.name}
                {unreadFrom.has(thread.partner.id) && <span className="dot dot-on" aria-label="Unread messages" />}
              </button>
            </li>
          ))}
        </ul>
        {newContacts.length > 0 && (
          <div className="field">
            <label htmlFor="new-dm">Start a new message</label>
            <select id="new-dm" value="" onChange={(e) => { const person = newContacts.find((c) => c.id === e.target.value); if (person) setActive({ kind: "dm", userId: person.id, title: person.name }); }}>
              <option value="">Choose a person…</option>
              {newContacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.role === "admin" ? " (instructor)" : ""}</option>)}
            </select>
          </div>
        )}
      </aside>

      <section className="chat-main card" aria-label={active ? `Conversation: ${active.title}` : "Conversation"}>
        {!active ? <p className="muted">Select a conversation to start chatting.</p> : (
          <>
            <header className="chat-head">
              <h2>{active.kind === "course" ? `# ${active.title}` : active.title}</h2>
              {!connected && <span className="muted">Offline: messages will be sent over a slower fallback.</span>}
            </header>
            <div className="chat-log" role="log" aria-live="polite" aria-label="Messages">
              {loadingMessages && <Spinner label="Loading messages" />}
              {!loadingMessages && messages.length === 0 && <p className="muted center">No messages yet. Say hello.</p>}
              {messages.map((message) => {
                const mine = message.sender.id === user.id;
                return (
                  <div key={message.id} className={`msg ${mine ? "msg-self" : "msg-other"}`}>
                    {!mine && <span className="msg-author">{message.sender.name}{message.sender.role === "admin" ? " · instructor" : ""}</span>}
                    <p className="bubble">{message.text}</p>
                    <time dateTime={message.createdAt}>{clock(message.createdAt)}</time>
                  </div>
                );
              })}
              {typing && <p className="muted typing" aria-live="polite">{typing} is typing…</p>}
              <div ref={bottom} />
            </div>
            <ErrorBanner error={error} />
            <form className="chat-form" onSubmit={send}>
              <label htmlFor="chat-input" className="visually-hidden">Message</label>
              <input id="chat-input" value={text} maxLength={2000} autoComplete="off" placeholder={`Message ${active.kind === "course" ? "#" + active.title : active.title}`} onChange={(e) => onType(e.target.value)} />
              <Button type="submit" loading={sending} disabled={!text.trim()}>Send</Button>
            </form>
          </>
        )}
      </section>
      {rooms.error && <Notice tone="error">{rooms.error.message}</Notice>}
    </div>
  );
}
