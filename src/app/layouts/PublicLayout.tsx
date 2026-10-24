import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

export interface PublicConfig {
  brandName: string;
  tagline: string;
  telegramUsername: string;
  referralName: string;
}

export function usePublicConfig(): PublicConfig | null {
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/public/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setCfg(d);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return cfg;
}

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/crypto-tools", label: "Crypto Tools" },
  { to: "/crypto-research", label: "Crypto Research" },
  { to: "/contact", label: "Contact" },
];

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  const cfg = usePublicConfig();
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">CT</span>
            <span>
              Crypto<span className="brand-sub">Tools</span>Hubb
            </span>
          </Link>

          <nav className={`nav ${open ? "open" : ""}`} aria-label="Main navigation">
            {NAV_LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
                {l.label}
              </NavLink>
            ))}
            <NavLink to="/risk-disclaimer" className={({ isActive }) => (isActive ? "active" : "")}>
              Risk Disclaimer
            </NavLink>
          </nav>

          <div className="header-cta">
            <Link to="/get-started" className="btn btn-primary btn-sm">
              Get Started
            </Link>
            <button
              className="nav-toggle"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label="Toggle navigation menu"
            >
              {open ? "✕" : "☰"}
            </button>
          </div>
        </div>
      </header>

      <main id="main">
        <Outlet context={cfg} />
      </main>

      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <Link to="/" className="brand">
                <span className="brand-mark">CT</span>
                <span>
                  Crypto<span className="brand-sub">Tools</span>Hubb
                </span>
              </Link>
              <p className="small muted mt-2" style={{ maxWidth: "42ch" }}>
                {cfg?.tagline ?? "Smarter Crypto Tools. Better-Informed Decisions."}
              </p>
              <p className="small muted">
                Educational resources and tool information for adults in the United States interested in cryptocurrency
                markets.
              </p>
            </div>
            <div>
              <h4>Explore</h4>
              <ul className="footer-links">
                <li>
                  <Link to="/crypto-tools">Crypto Tools</Link>
                </li>
                <li>
                  <Link to="/crypto-research">Crypto Research</Link>
                </li>
                <li>
                  <Link to="/get-started">Get Started</Link>
                </li>
                <li>
                  <Link to="/contact">Contact</Link>
                </li>
              </ul>
            </div>
            <div>
              <h4>Legal</h4>
              <ul className="footer-links">
                <li>
                  <Link to="/privacy">Privacy Policy</Link>
                </li>
                <li>
                  <Link to="/terms">Terms of Use</Link>
                </li>
                <li>
                  <Link to="/risk-disclaimer">Cryptocurrency Risk Disclaimer</Link>
                </li>
                <li>
                  <Link to="/unsubscribe">Unsubscribe from emails</Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="footer-legal">
            <p>
              <strong>Risk warning:</strong> Cryptocurrency trading and investment carry substantial risk. Prices are
              volatile and you may lose some or all of the money you invest. Nothing on this website is financial advice,
              and no outcome, return, or profit is promised or guaranteed. This website does not solicit the purchase or
              sale of any specific asset.
            </p>
            <p className="mb-0">
              © {new Date().getFullYear()} CryptoToolsHubb. Educational content only · For US audiences ·{" "}
              <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link>
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
