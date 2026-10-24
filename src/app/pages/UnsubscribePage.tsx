import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

type State = "idle" | "loading" | "done" | "error";

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<State>("idle");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    if (!token) return;
    setState("loading");
    api
      .post<{ message: string }>("/api/public/unsubscribe", { token })
      .then((r) => {
        setMsg(r.message);
        setState("done");
      })
      .catch((e) => {
        setMsg(e instanceof Error ? e.message : "Link is invalid.");
        setState("error");
      });
  }, [token]);

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="form-card">
          <h1 style={{ fontSize: "1.5rem" }}>Unsubscribe</h1>
          {!token && (
            <>
              <div className="form-error" role="alert">
                This page needs an unsubscribe token. Use the link included in any email you received from us.
              </div>
              <p className="small muted">
                If you no longer have the link, contact us via the <Link to="/contact">Contact page</Link> and we'll
                remove you from promotional messages.
              </p>
            </>
          )}
          {state === "loading" && (
            <div className="loading">
              <div className="spinner" />
              Processing…
            </div>
          )}
          {state === "done" && (
            <>
              <div className="form-success" role="status">
                {msg}
              </div>
              <p className="small muted">
                You will no longer receive promotional messages from CryptoToolsHubb. Transactional replies to your
                direct inquiries may still be sent.
              </p>
              <Link to="/" className="btn btn-secondary btn-sm">
                Back to home
              </Link>
            </>
          )}
          {state === "error" && (
            <>
              <div className="form-error" role="alert">
                {msg}
              </div>
              <p className="small muted">
                Request removal manually via the <Link to="/contact">Contact page</Link>.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
