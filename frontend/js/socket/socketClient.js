/* ============================================================
   socketClient.js — realtime notifications (socket.io-client via CDN)
   ============================================================ */
const SocketClient = {
  socket: null,
  init() {
    if (this.socket || !window.io) return;
    const token = AuthUtil.getToken();
    if (!token) return;

    this.socket = io(window.EDUTRACK_SOCKET_BASE || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => console.log('[socket] connected', this.socket.id));
    this.socket.on('disconnect', () => console.log('[socket] disconnected'));

    this.socket.on('notification:new', (payload) => {
      Toast.info(payload.message || 'You have a new notification');
      document.dispatchEvent(new CustomEvent('edutrack:notification', { detail: payload }));
      const dot = document.querySelector('.notif-dot');
      if (dot) dot.classList.add('has-unread');
    });

    this.socket.on('progress:updated', (payload) => {
      document.dispatchEvent(new CustomEvent('edutrack:progress-updated', { detail: payload }));
    });
  },
  disconnect() {
    if (this.socket) { this.socket.disconnect(); this.socket = null; }
  },
};
window.SocketClient = SocketClient;
