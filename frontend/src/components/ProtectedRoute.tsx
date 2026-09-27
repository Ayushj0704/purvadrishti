import { Navigate, Outlet } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { DemoSimulator } from "./DemoSimulator";

export function ProtectedRoute() {
  const token = localStorage.getItem("auth_token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      <Outlet />
      <DemoSimulator />
    </AppShell>
  );
}
