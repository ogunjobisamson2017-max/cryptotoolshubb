import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useOutletContext } from "react-router-dom";
import type { PublicConfig } from "../layouts/PublicLayout";
import { api, storedAttribution, telegramLink, trackTelegramClick } from "../lib/api";

interface RegistrationResult {
  ok: boolean;
  duplicate: boolean;
  referralId: string;
  firstName: string;
  unsubscribeToken: string;
  registeredAt: string;
  message: string;
}

const COUNTRIES = [
  "United States",
  ...["Canada", "Mexico", "United Kingdom", "Australia", "Germany", "France", "Japan", "Singapore", "Other"].filter(
    (c) => c !== "United States",
  ),
];

const INTERESTS = ["Trading Bots", "Crypto Research", "Both"] as const;
const CONTACT_METHODS = ["Email", "Telegram", "No preference"] as const;

export default function GetStartedPage() {
  const cfg = useOutletContext<PublicConfig | null>();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("United States");
  const [interest, setInterest] = useState<(typeof INTERESTS)[number]>("Both");
  const [contactMethod, setContactMethod] = useState<(typeof CONTACT_METHODS)[number]>("No preference");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [clickTracked, setClickTracked] = useState(false);

  const cfgLoading = cfg === null;
  const brand = cfg?.brandName ?? "CryptoToolsHubb";
  const telegram = cfg?.telegramUsername ?? "Azriel_xoxo";
  const referralName = cfg?.referralName ?? "Samjoe1234";

  const tgLink = useMemo(() => {
    if (!result) return "#";
    return telegramLink(telegram, result.referralId, referralName, brand);
  }, [result, telegram, referralName, brand]);

  useEffect(() => {
    document.title = "Get Started — CryptoToolsHubb";
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError("Please check the consent box so we may contact you about the services you requested.");
      return;
    }
    setLoading(true);
    try {
      const attr = storedAttribution();
      const res = await api.post<RegistrationResult>("/api/public/leads", {
        firstName,
        email,
        country,
        interest,
        contactMethod,
        consent: true,
        source: attr.source,
        medium: attr.medium,
        campaign: attr.campaign,
        refCode: attr.refCode,
        utmContent: attr.content,
        landingPage: window.location.pathname + window.location.search,
        referrer: document.referrer ? document.referrer.slice(0, 300) : null,
      });
      setResult(res);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function onTelegramClick() {
    if (!result || clickTracked) return;
    setClickTracked(true);
    await trackTelegramClick(result.referralId);
    window.open(tgLink, "_blank", "noopener,noreferrer");
  }

  /* --------------------------- confirmation view --------------------------- */
  if (result) {
    return (
      <section className="section">
        <div className="container">
          <div className="form-card confirm-panel">
            <div style={{ fontSize: "2.6rem" }} aria-hidden="true">
              ✅
            </div>
            <h1 style={{ fontSize: "1.6rem" }}>
              {result.duplicate ? "You're already registered" : "Registration confirmed"}
            </h1>
            <p className="muted">
              {result.duplicate
                ? "This email already has a referral ID — use it in your message below."
                : `Thanks, ${result.firstName}! Your details are saved and a unique referral ID has been assigned to you.`}
            </p>

            <div className="referral-id" data-testid="referral-id">
              {result.referralId}
            </div>
            <p className="tiny muted">
              Registered: {new Date(result.registeredAt).toLocaleString()} · Save this ID — quote it in every message.
            </p>

            <div className="notice green" style={{ textAlign: "left", marginTop: 20 }}>
              <strong>Next step:</strong> open a Telegram chat with our supervisor. The message below is prefilled with
              your referral ID — <em>you review it and press Send yourself</em>. Nothing is sent automatically.
            </div>

            <div className="link-box mt-2" style={{ textAlign: "left", fontSize: "0.76rem" }}>
              {`Hello, I'm interested in your crypto services. I found you through ${brand}. Referral name: ${referralName}. Referral ID: ${result.referralId}.`}
            </div>

            <button
              className="btn btn-telegram btn-block mt-3"
              onClick={onTelegramClick}
              data-testid="telegram-button"
              aria-label={`Contact supervisor ${telegram} on Telegram`}
            >
              ✈️ Contact Supervisor on Telegram
            </button>

            <p className="tiny muted mt-2">
              Opens t.me/{telegram}. Your click is recorded as referral activity — it is not a sale and not proof a
              message was sent.
            </p>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "22px 0" }} />

            <div className="small muted" style={{ textAlign: "left" }}>
              <p>
                <strong>What we saved:</strong> your first name, email, country, interest and consent timestamp. We did
                not ask for — and you should never share — passwords, bank details, seed phrases, private keys or
                verification codes.
              </p>
              <p className="mb-0">
                Marketing emails include an unsubscribe link, or use ours:{" "}
                <Link to={`/unsubscribe?token=${result.unsubscribeToken}`}>unsubscribe now</Link>.
              </p>
            </div>

            <div className="hero-actions mt-3" style={{ justifyContent: "center" }}>
              <Link to="/crypto-research" className="btn btn-secondary btn-sm">
                Read research while you wait
              </Link>
              <Link to="/" className="btn btn-ghost btn-sm">
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  /* ------------------------------ form view -------------------------------- */
  return (
    <>
      <section className="hero">
        <div className="container">
          <span className="eyebrow">Step 1 of 2</span>
          <h1>Get Started</h1>
          <p className="hero-sub">
            Register to receive your unique referral ID ({`CTH-######`}) and a prefilled introduction to our supervisor
            on Telegram. Fields marked <span className="req" style={{ color: "var(--green-bright)" }}>*</span> are
            required.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <form className="form-card" onSubmit={onSubmit} noValidate>
            <h2 style={{ fontSize: "1.3rem" }}>Lead registration</h2>

            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}

            <div className="field">
              <label htmlFor="firstName">
                First name <span className="req">*</span>
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                autoComplete="given-name"
                required
                maxLength={60}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jordan"
              />
            </div>

            <div className="field">
              <label htmlFor="email">
                Email address <span className="req">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <div className="hint">Used only to contact you about the services you requested.</div>
            </div>

            <div className="field">
              <label htmlFor="country">
                Country <span className="req">*</span>
              </label>
              <select id="country" name="country" value={country} onChange={(e) => setCountry(e.target.value)} required>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <div className="hint">Our services are aimed at adults located in the United States.</div>
            </div>

            <div className="field">
              <label htmlFor="interest">
                Main interest <span className="req">*</span>
              </label>
              <select
                id="interest"
                name="interest"
                value={interest}
                onChange={(e) => setInterest(e.target.value as (typeof INTERESTS)[number])}
                required
              >
                {INTERESTS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="contactMethod">Preferred contact method (optional)</label>
              <select
                id="contactMethod"
                name="contactMethod"
                value={contactMethod}
                onChange={(e) => setContactMethod(e.target.value as (typeof CONTACT_METHODS)[number])}
              >
                {CONTACT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="check" htmlFor="consent">
                <input
                  id="consent"
                  name="consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                />
                <span>
                  I consent to CryptoToolsHubb contacting me about crypto trading tools, bot subscriptions and research
                  services I've requested. I can unsubscribe from promotional messages at any time.{" "}
                  <span className="req">*</span>
                </span>
              </label>
            </div>

            <div className="notice info">
              <strong>Privacy notice:</strong> we collect only the information above, store it securely, never sell it,
              and never ask for passwords, bank details, seed phrases, private keys or verification codes. See our{" "}
              <Link to="/privacy">Privacy Policy</Link>. By registering you confirm you are an adult (18+).
            </div>

            <button className="btn btn-primary btn-block mt-3" type="submit" disabled={loading || cfgLoading}>
              {loading ? "Registering…" : "Register & Get Referral ID"}
            </button>

            <p className="tiny muted center mt-2 mb-0">
              No payment, no password, no obligation. <Link to="/risk-disclaimer">Risk disclaimer</Link>
            </p>
          </form>
        </div>
      </section>
    </>
  );
}
