import { Navigate, Outlet, useLocation } from "react-router";
import { Spinner } from "../components/ui";
import { useAuth } from "./AuthContext";

function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner className="h-7 w-7 text-neutral-400" />
    </div>
  );
}

export function RequireAuth() {
  const { token, status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <Loading />;
  if (!token) return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function GuestOnly() {
  const { token, status } = useAuth();
  if (status === "loading") return <Loading />;
  if (token) return <Navigate to="/" replace />;
  return <Outlet />;
}
