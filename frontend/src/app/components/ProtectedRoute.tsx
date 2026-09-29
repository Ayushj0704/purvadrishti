import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { SampleIngest } from "./SampleIngest";
import { clearSession, isExpired } from "../api/auth";

/**
 * Gate for the console. Reads the real session the login call stored, and
 * bounces to /login when there is no token or the token's own expiry has
 * passed — the local expiry check is a courtesy that saves a round trip, not a
 * security boundary. The backend still validates every request.
 */
export function ProtectedRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("purva.session");

  // The 401 hook clears the session from anywhere in the app; this listener
  // turns that into a redirect without every page re-implementing it.
  useEffect(() => {
    if (token) return;
    navigate("/login", { replace: true, state: { from: location.pathname } });
  }, [token, navigate, location.pathname]);

  if (!token || isExpired()) {
    if (isExpired()) clearSession();
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      <Outlet />
      <SampleIngest />
    </AppShell>
  );
}
