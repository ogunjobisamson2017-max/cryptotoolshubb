import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function LoginPage({
  onSignedIn,
  notice,
}: {
  onSignedIn: () => Promise<void>;
  notice?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get<{ needsSetup: boolean }>("/api/admin/auth/setup-status")
      .then((r) => setNeedsSetup(r.needsSetup))
      .catch(() => undefined);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/api/admin/auth/login", { email, password });
      await onSignedIn();
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <form className="form-card" onSubmit={submit} noValidate style={{ width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <Link to="/" className="brand" style={{ justifyContent: "center" }}>
            <span className="brand-mark">CT</span>
            <span>
              Crypto<span className="brand-sub">Tools</span>Hubb
            </span>
          </Link>
          <h1 style={{ fontSize: "1.35rem", marginTop: 14 }}>Admin sign in</h1>
          <p className="small muted mb-0">Authorized administrators only. Access is logged and audited.</p>
        </div>

        {notice && <div className="form-error">{notice}</div>}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <div className="field">
          <label htmlFor="lemail">Email</label>
          <input
            id="lemail"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="lpass">Password</label>
          <input
            id="lpass"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>

        {needsSetup && (
          <p className="small center mt-3 mb-0 muted">
            First run? <Link to="/admin/setup">Create the administrator account →</Link>
          </p>
        )}
        <p className="tiny muted center mt-2 mb-0">
          <Link to="/">← Back to website</Link>
        </p>
      </form>
    </div>
  );
}
