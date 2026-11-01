/**
 * Content-Security-Policy for the built client. The same policy is applied by:
 *   - `vite preview` (vite.config.js), so end-to-end tests run under it,
 *   - nginx.conf (Docker image) and vercel.json (Vercel).  Keep the three in sync.
 * Inline scripts are forbidden; the only inline allowance is for style attributes (progress bars).
 * connect-src lists the API host: adjust the *.onrender.com entries if the API is hosted elsewhere.
 */
export const csp = [
  "default-src 'self'",
  "script-src 'self' https://www.youtube.com https://s.ytimg.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://i.ytimg.com",
  "font-src 'self'",
  "connect-src 'self' ws: wss: https://*.onrender.com",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");
