import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
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

function App() {
  return (
    <BrowserRouter basename={BASENAME}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/cases/:id" element={<CaseDetail />} />
          <Route path="/cases/:id/report" element={<CaseReport />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/analytics" element={<Analytics />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
