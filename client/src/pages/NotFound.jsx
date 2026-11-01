import { Link } from "react-router-dom";
import { useDocumentTitle } from "../hooks.js";

export default function NotFound() {
  useDocumentTitle("Page not found");
  return (
    <div className="empty">
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist or has moved.</p>
      <Link className="btn btn-primary" to="/">Back to home</Link>
    </div>
  );
}
