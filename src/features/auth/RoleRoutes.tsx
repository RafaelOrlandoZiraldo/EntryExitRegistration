import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function HomeRedirect() {
  const auth = useAuth();

  return (
    <Navigate
      to={
        auth.session?.role === "admin"
          ? "/users"
          : auth.session?.role === "seller"
            ? "/seller-dashboard"
            : "/dashboard"
      }
      replace
    />
  );
}

export function AdminOnlyRoute() {
  const auth = useAuth();

  if (auth.session?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function UserOnlyRoute() {
  const auth = useAuth();

  if (auth.session?.role !== "user") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function SellerOnlyRoute() {
  const auth = useAuth();

  if (auth.session?.role !== "seller") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
