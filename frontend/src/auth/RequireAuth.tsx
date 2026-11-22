import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { Role } from "../api/client";
import { FullScreenLoader } from "../components/FullScreenLoader";

export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/app" replace />;
  }
  return <Outlet />;
}
