import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { ToastProvider } from "./shared";
import LoginPage from "./LoginPage";
import SetupPage from "./SetupPage";
import OverviewPage from "./OverviewPage";
import LeadsPage from "./LeadsPage";
import SalesPage from "./SalesPage";
import GrowthPage from "./GrowthPage";
import ReportsPage from "./ReportsPage";
import SettingsPage from "./SettingsPage";

interface Admin {
  id: number;
  email: string;
  role: string;
}

type AuthState = { status: "checking" } | { status: "out" } | { status: "in"; admin: Admin };

const NAV = [
  { to: "/admin", label: "Overview", icon: "📊", end: true },
  { to: "/admin/leads", label: "Leads", icon: "👥", end: false },
  { to: "/admin/sales", label: "Sales & Commission", icon: "💵", end: false },
  { to: "/admin/growth", label: "Growth Center", icon: "🚀", end: false },
  { to: "/admin/reports", label: "Reports", icon: "📁", end: false },
  { to: "/admin/settings", label: "Settings", icon: "⚙️", end: false },
];

export default function AdminApp() {
  const [auth, setAuth] = useState<AuthState>({ status: "checking" });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const check = useCallback(async () => {
    try {
      const r = await api.get<{ admin: Admin }>("/api/admin/auth/me");
      setAuth({ status: "in", admin: r.admin });
    } catch {
      setAuth({ status: "out" });
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  async function logout() {
    try {
      await api.post("/api/admin/auth/logout");
    } finally {
      setAuth({ status: "out" });
      navigate("/admin/login", { replace: true });
    }
  }

  if (auth.status === "checking") {
    return (
      <div className="loading" style={{ minHeight: "100vh" }}>
        <div className="spinner" />
        Checking session…
      </div>
    );
  }

  if (auth.status === "out") {
    return (
      <ToastProvider>
        <Routes>
          <Route path="login" element={<LoginPage onSignedIn={check} />} />
          <Route path="setup" element={<SetupPage onSignedIn={check} />} />
          <Route
            path="*"
            element={
              <LoginPage
                onSignedIn={check}
                notice="Sign in to access the CryptoToolsHubb admin dashboard."
              />
            }
          />
        </Routes>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="admin-shell">
        <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`} aria-label="Admin navigation">
          <Link to="/" className="brand">
            <span className="brand-mark">CT</span>
            <span>
              Crypto<span className="brand-sub">Tools</span>Hubb
            </span>
          </Link>
          <div className="side-section">Dashboard</div>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `side-link ${isActive ? "active" : ""}`}
            >
              <span aria-hidden="true">{n.icon}</span> {n.label}
            </NavLink>
          ))}
          <div className="side-section">Public site</div>
          <NavLink to="/" className="side-link">
            <span aria-hidden="true">🌐</span> View website
          </NavLink>
          <div className="side-foot">
            <div className="tiny muted" style={{ padding: "0 12px 8px", wordBreak: "break-all" }}>
              {auth.admin.email}
              <br />
              role: {auth.admin.role}
            </div>
            <button className="btn btn-ghost btn-sm btn-block" onClick={logout}>
              Sign out
            </button>
          </div>
        </aside>

        <div className="admin-main">
          <div className="admin-topbar">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                className="btn btn-ghost btn-sm sidebar-toggle"
                onClick={() => setSidebarOpen((o) => !o)}
                aria-label="Toggle sidebar"
              >
                ☰
              </button>
              <h1>CryptoToolsHubb Admin</h1>
            </div>
            <Link to="/" className="btn btn-ghost btn-sm">
              View site ↗
            </Link>
          </div>

          <div className="admin-body">
            <Routes>
              <Route index element={<OverviewPage />} />
              <Route path="leads" element={<LeadsPage />} />
              <Route path="sales" element={<SalesPage />} />
              <Route path="growth" element={<GrowthPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<OverviewPage />} />
            </Routes>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}

export type { Admin };
export { ApiError };
