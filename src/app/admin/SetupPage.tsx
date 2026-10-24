import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function SetupPage({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [status, setStatus] = useState<"checking" | "needed" | "done">("checking");
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get<{ needsSetup: boolean }>("/api/admin/auth/setup-status")
      .then((r) => setStatus(r.needsSetup ? "needed" : "done"))
      .catch(() => setStatus("needed"));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 12 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setError("Password must be at least 12 characters and include a letter and a number.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/admin/auth/setup", { setupToken: token, email, password });
      await onSignedIn();
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed.");
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
          <h1 style={{ fontSize: "1.35rem", marginTop: 14 }}>Create administrator account</h1>
        </div>

        {status === "checking" && <p className="muted small">Checking setup status…</p>}
        {status === "done" && (
          <div className="form-success">
            Setup already completed — sign in instead. <Link to="/admin/login">Go to sign in →</Link>
          </div>
        )}

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <div className="field">
          <label htmlFor="stoken">Setup token</label>
          <input
            id="stoken"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Value of ADMIN_SETUP_TOKEN"
            required
          />
          <div className="hint">Provided in your deployment configuration. Enables one-time account creation only.</div>
        </div>
        <div className="field">
          <label htmlFor="semail">Admin email</label>
          <input
            id="semail"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="spass">Password</label>
          <input
            id="spass"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <div className="hint">At least 12 characters, including a letter and a number.</div>
        </div>
        <div className="field">
          <label htmlFor="sconfirm">Confirm password</label>
          <input
            id="sconfirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={loading || status !== "needed"}>
          {loading ? "Creating…" : "Create account & sign in"}
        </button>
        <p className="tiny muted center mt-2 mb-0">
          <Link to="/admin/login">← Back to sign in</Link>
        </p>
      </form>
    </div>
  );
}
