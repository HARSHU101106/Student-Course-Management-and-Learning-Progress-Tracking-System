// Apply the saved theme before first paint to avoid a flash. Kept as an external file so the
// Content-Security-Policy can forbid inline scripts entirely.
try {
  var t = localStorage.getItem("adaptlearn.theme");
  var dark = t === "dark" || ((!t || t === "system") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) document.documentElement.classList.add("dark");
} catch (e) {}
