import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Spinner } from "./ui.jsx";

/** Gate a group of routes behind sign-in and (optionally) a role. */
export default function RequireAuth({ role }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (role && user.role !== role) return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
  return <Outlet />;
}
