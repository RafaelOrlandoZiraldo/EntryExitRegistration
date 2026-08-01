import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.isAuthenticated) {
    const redirectTo = encodeURIComponent(
      `${location.pathname}${location.search}`
    );

    return <Navigate to={`/login?redirectTo=${redirectTo}`} replace />;
  }

  return <Outlet />;
}
