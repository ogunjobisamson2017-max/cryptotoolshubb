import { useEffect, useState } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import PublicLayout from "./layouts/PublicLayout";
import HomePage from "./pages/HomePage";
import ToolsPage from "./pages/ToolsPage";
import ResearchPage from "./pages/ResearchPage";
import GetStartedPage from "./pages/GetStartedPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import DisclaimerPage from "./pages/DisclaimerPage";
import ContactPage from "./pages/ContactPage";
import UnsubscribePage from "./pages/UnsubscribePage";
import AdminApp from "./admin/AdminApp";
import { trackView } from "./lib/api";

/** Count a first-party page view on every navigation (captured events only). */
function ViewTracker(): null {
  const { pathname } = useLocation();
  useEffect(() => {
    trackView(pathname);
  }, [pathname]);
  return null;
}

function ScrollToTop(): null {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <ViewTracker />
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/crypto-tools" element={<ToolsPage />} />
          <Route path="/crypto-research" element={<ResearchPage />} />
          <Route path="/get-started" element={<GetStartedPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/risk-disclaimer" element={<DisclaimerPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/unsubscribe" element={<UnsubscribePage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}

function NotFound() {
  const [sec, setSec] = useState(5);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="section container center">
      <h1>404 — Page not found</h1>
      <p className="muted">The page you're looking for doesn't exist.</p>
      <p>
        <a className="btn btn-primary" href="/">
          Back to homepage
        </a>
      </p>
      <p className="tiny muted">Redirecting in {Math.max(sec, 0)}s…</p>
      {sec <= 0 ? <Navigate to="/" replace /> : null}
    </div>
  );
}
