import { Navigate } from "react-router-dom";

export default function AdminRoute({ user, children }) {
  return user?.role === "admin" ? (
    children
  ) : (
    <Navigate to={user ? "/dashboard" : "/login"} replace />
  );
}
