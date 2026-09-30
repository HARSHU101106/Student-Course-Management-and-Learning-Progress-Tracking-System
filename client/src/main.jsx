import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import { CourseProvider } from "./context/CourseContext.jsx";
import { AIProvider } from "./context/AIContext.jsx";
import "./styles/index.css";

async function startApp() {
  if (import.meta.env.DEV && import.meta.env.VITE_API_MOCKING !== "disabled") {
    const { setupMocks } = await import("./mocks/browser.js");
    await setupMocks();
  }

  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <CourseProvider>
        <AIProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </AIProvider>
      </CourseProvider>
    </StrictMode>,
  );
}

startApp();
