import { useState, type FormEvent } from "react";
import { Link, useOutletContext } from "react-router-dom";
import type { PublicConfig } from "../layouts/PublicLayout";

export default function ContactPage() {
  const cfg = useOutletContext<PublicConfig | null>();
  const telegram = cfg?.telegramUsername ?? "Azriel_xoxo";
  const brand = cfg?.brandName ?? "CryptoToolsHubb";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("General question");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in your name, email and message.");
      return;
    }
    setStatus("loading");
    try {
      // Reuses the lead pipeline: contact requests are recorded as consented leads.
      const res = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: name.trim().slice(0, 60),
          email: email.trim(),
          country: "United States",
          interest: topic === "Trading bots" ? "Trading Bots" : topic === "Crypto research" ? "Crypto Research" : "Both",
          contactMethod: "Email",
          consent: true,
          source: "contact_page",
          medium: "form",
          landingPage: "/contact",
          refCode: `contact:${topic}`.slice(0, 60),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to send.");
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to send. Please try Telegram instead.");
    }
  }

  return (
    <>
      <section className="hero">
        <div className="container">
          <span className="eyebrow">Contact</span>
          <h1>Contact CryptoToolsHubb</h1>
          <p className="hero-sub">
            Questions about trading tools, subscriptions or research? Reach us through the form below or directly on
            Telegram. We respond to registered inquiries in the order received.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container grid grid-2" style={{ alignItems: "start" }}>
          <div className="card">
            <h3>
              <span className="card-icon blue">✈️</span> Telegram (fastest)
            </h3>
            <p>
              Message our supervisor directly. For the fastest routing, register first and include your referral ID in
              the prefilled message.
            </p>
            <a className="btn btn-telegram" href={`https://t.me/${telegram}`} target="_blank" rel="noopener noreferrer">
              Open @{telegram} on Telegram
            </a>
            <p className="tiny muted mt-2">
              Telegram clicks are recorded as referral activity only. A click never confirms a message was sent or a
              sale occurred.
            </p>
            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "18px 0" }} />
            <p className="small muted mb-0">
              Don't have a referral ID yet? <Link to="/get-started">Register here</Link> — it takes under a minute.
            </p>
          </div>

          <div>
            {status === "sent" ? (
              <div className="form-card" style={{ margin: 0 }}>
                <div className="confirm-panel">
                  <div style={{ fontSize: "2.4rem" }} aria-hidden="true">
                    ✅
                  </div>
                  <h2 style={{ fontSize: "1.4rem" }}>Message received</h2>
                  <p className="muted">
                    Thanks — your inquiry was recorded. Watch your inbox for a reply, or message us on Telegram with any
                    referral ID you have.
                  </p>
                  <Link to="/" className="btn btn-secondary btn-sm">
                    Back to home
                  </Link>
                </div>
              </div>
            ) : (
              <form className="form-card" style={{ margin: 0 }} onSubmit={onSubmit} noValidate>
                <h2 style={{ fontSize: "1.25rem" }}>Send an inquiry</h2>
                {error && (
                  <div className="form-error" role="alert">
                    {error}
                  </div>
                )}
                <div className="field">
                  <label htmlFor="cname">Your name *</label>
                  <input id="cname" type="text" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="field">
                  <label htmlFor="cemail">Email *</label>
                  <input
                    id="cemail"
                    type="email"
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="ctopic">Topic</label>
                  <select id="ctopic" value={topic} onChange={(e) => setTopic(e.target.value)}>
                    <option>General question</option>
                    <option>Trading bots</option>
                    <option>Crypto research</option>
                    <option>Subscription details</option>
                    <option>Privacy / data request</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="cmsg">Message *</label>
                  <textarea
                    id="cmsg"
                    maxLength={2000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="How can we help?"
                    required
                  />
                </div>
                <div className="notice danger tiny">
                  <strong>Never send</strong> passwords, bank details, seed phrases, private keys or verification codes
                  — we will never ask for them.
                </div>
                <button className="btn btn-primary btn-block mt-3" type="submit" disabled={status === "loading"}>
                  {status === "loading" ? "Sending…" : "Send message"}
                </button>
                <p className="tiny muted center mt-2 mb-0">
                  By sending you consent to us contacting you about your inquiry. See our <Link to="/privacy">Privacy Policy</Link>.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
