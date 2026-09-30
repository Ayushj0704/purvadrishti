import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Cases } from "./pages/Cases";
import { CaseDetail } from "./pages/CaseDetail";
import { CaseReport } from "./pages/CaseReport";
import { Alerts } from "./pages/Alerts";
import { Analytics } from "./pages/Analytics";

/**
 * The console half of the site. Served from /dashboard/ as its own HTML entry
 * point, so this graph never pulls in the landing page's Three.js / GSAP /
 * Lenis. See vite.config.ts — the separation is enforced by the bundler, not
 * by convention.
 */
const BASENAME = "/dashboard";

/** React Router keeps scroll across navigations — without this, following a
 *  link (or the demo sequence jumping pages) lands you wherever the last
 *  page's scroll was, usually the bottom. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function App() {
  return (
    <BrowserRouter basename={BASENAME}>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<RouteErrorBoundary><Dashboard /></RouteErrorBoundary>} />
          <Route path="/cases" element={<RouteErrorBoundary><Cases /></RouteErrorBoundary>} />
          <Route path="/cases/:id" element={<RouteErrorBoundary><CaseDetail /></RouteErrorBoundary>} />
          <Route path="/cases/:id/report" element={<RouteErrorBoundary><CaseReport /></RouteErrorBoundary>} />
          <Route path="/alerts" element={<RouteErrorBoundary><Alerts /></RouteErrorBoundary>} />
          <Route path="/analytics" element={<RouteErrorBoundary><Analytics /></RouteErrorBoundary>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
