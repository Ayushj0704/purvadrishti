import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SmoothScroll } from "./lib/smoothScroll";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { CaseDetail } from "./pages/CaseDetail";
import { Alerts } from "./pages/Alerts";
import { Analytics } from "./pages/Analytics";

function App() {
  return (
    <BrowserRouter>
      {/* Inside the router: it resets scroll on navigation via useLocation. */}
      <SmoothScroll>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cases/:id" element={<CaseDetail />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/analytics" element={<Analytics />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SmoothScroll>
    </BrowserRouter>
  );
}

export default App;
