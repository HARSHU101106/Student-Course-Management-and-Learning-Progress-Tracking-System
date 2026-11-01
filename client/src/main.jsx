import { Component, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { RealtimeProvider } from "./context/RealtimeContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import "./styles/tokens.css";
import "./styles/app.css";

/** Last line of defence: a render bug shows a recovery screen instead of a blank page. */
class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("Unhandled UI error", error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="empty" role="alert" style={{ margin: "4rem auto", maxWidth: "32rem" }}>
        <h1>Something went wrong</h1>
        <p>The page hit an unexpected error. Your data is safe.</p>
        <button className="btn btn-primary" onClick={() => window.location.assign("/")}>Reload AdaptLearn</button>
      </div>
    );
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <RealtimeProvider>
              <App />
            </RealtimeProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
