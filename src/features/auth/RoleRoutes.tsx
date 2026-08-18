import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function HomeRedirect() {
  const auth = useAuth();

  return (
    <Navigate
      to={auth.session?.role === "admin" ? "/users" : "/transactions"}
      replace
    />
  );
}

export function AdminOnlyRoute() {
  const auth = useAuth();

  if (auth.session?.role !== "admin") {
    return <Navigate to="/transactions" replace />;
  }

  return <Outlet />;
}

export function UserOnlyRoute() {
  const auth = useAuth();

  if (auth.session?.role === "admin") {
    return <Navigate to="/users" replace />;
  }

  return <Outlet />;
}
