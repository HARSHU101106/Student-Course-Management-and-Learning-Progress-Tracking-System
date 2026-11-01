import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { csp } from "./csp.js";

const target = process.env.VITE_DEV_API_TARGET || "http://localhost:5000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target, changeOrigin: true },
      "/socket.io": { target, ws: true, changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    headers: { "Content-Security-Policy": csp, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin" },
  },
  build: { sourcemap: false, chunkSizeWarningLimit: 600 },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.js"],
    include: ["tests/**/*.test.{js,jsx}"],
    css: false,
  },
});
