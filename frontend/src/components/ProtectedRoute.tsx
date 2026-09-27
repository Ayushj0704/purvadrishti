import { Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import { AppShell } from './AppShell';
import { DemoModeBanner } from './DemoModeBanner';
import { DemoSimulator } from './DemoSimulator';

export function ProtectedRoute() {
  const token = localStorage.getItem('auth_token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ThemeProvider>
      <AppShell>
        <DemoModeBanner />
        <Outlet />
        <DemoSimulator />
      </AppShell>
    </ThemeProvider>
  );
}
