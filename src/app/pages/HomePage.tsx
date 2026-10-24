import { Link } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import type { PublicConfig } from "../layouts/PublicLayout";

const TOOL_CARDS = [
  {
    icon: "🤖",
    blue: false,
    title: "Trading Bots & Automation",
    text: "Explore subscription-based trading tools and bot platforms: what they do, what to check before subscribing, and how automation changes your risk profile.",
  },
  {
    icon: "📡",
    blue: true,
    title: "Market Monitoring",
    text: "Track price action, volatility, volume and on-chain movement with monitoring tools — so you're reacting to data instead of noise.",
  },
  {
    icon: "📊",
    blue: false,
    title: "Signals & Research",
    text: "Understand what trading signals actually are, how they're produced, and the questions to ask before acting on any of them.",
  },
  {
    icon: "🔐",
    blue: true,
    title: "Wallet Security",
    text: "Practical security habits for self-custody: seed phrase hygiene, scam resistance and transaction verification.",
  },
  {
    icon: "📚",
    blue: false,
    title: "Educational Resources",
    text: "Plain-English research explainers covering market structure, risk management, and evaluating crypto tools critically.",
  },
  {
    icon: "🧮",
    blue: true,
    title: "Tool Evaluation Frameworks",
    text: "Structured questions for judging any crypto tool: data sources, fees, security posture, track record claims and disclosures.",
  },
];

const FAQS = [
  {
    q: "What is CryptoToolsHubb?",
    a: "CryptoToolsHubb is an educational resource and tool-information website. We publish research explainers, risk education and information about crypto trading tools so visitors can make better-informed decisions. We do not provide financial advice or manage money.",
  },
  {
    q: "Do you guarantee profits or returns?",
    a: "No. Nobody can guarantee returns in crypto markets, and anyone who does should be treated with suspicion. Trading bots, signals and market data are tools — outcomes depend on markets, execution and risk management, and losses are possible.",
  },
  {
    q: "What happens when I register?",
    a: "We record your first name, email, country and interest area so we can contact you about the services you asked about, and we assign you a unique referral ID (like CTH-000001). You can unsubscribe from promotional messages at any time using the link we provide.",
  },
  {
    q: "How do I talk to someone about the services?",
    a: "After registering you'll get a button that opens a Telegram conversation with our supervisor with your referral ID prefilled. You review the message and press Send yourself — nothing is sent automatically.",
  },
  {
    q: "Is this financial advice?",
    a: "No. All content here is educational. It does not consider your circumstances and is not a recommendation to buy, sell or hold any asset. Consider consulting a licensed professional before making investment decisions.",
  },
  {
    q: "How is my data handled?",
    a: "We collect only what's needed to respond to your request, store it in a secured database, and never sell it. See the Privacy Policy for details, including how to request deletion.",
  },
];

export default function HomePage() {
  const cfg = useOutletContext<PublicConfig | null>();
  const brand = cfg?.brandName ?? "CryptoToolsHubb";
  const telegram = cfg?.telegramUsername ?? "Azriel_xoxo";

  return (
    <>
      {/* ------------------------------- hero ------------------------------- */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">Crypto tools · Research · Education</span>
            <h1>
              Smarter Crypto Tools. <span>Better-Informed Decisions.</span>
            </h1>
            <p className="hero-sub">
              {brand} helps US-based crypto enthusiasts discover trading tools, understand market research, and evaluate
              trading bots and signals critically — before risking money on hype.
            </p>
            <div className="hero-actions">
              <Link to="/crypto-tools" className="btn btn-primary">
                Explore Crypto Tools
              </Link>
              <Link to="/get-started" className="btn btn-secondary">
                Get Started
              </Link>
            </div>
            <p className="tiny muted mt-3">
              Educational content only. Crypto trading carries risk of loss — no returns are guaranteed.
            </p>
          </div>

          <div className="hero-card" aria-hidden="true">
            <div className="hero-stat">
              <span>Trading bots &amp; automation</span>
              <b>TOOLS</b>
            </div>
            <div className="hero-stat">
              <span>Market monitoring &amp; signals</span>
              <b>DATA</b>
            </div>
            <div className="hero-stat">
              <span>Research explainers</span>
              <b>LEARN</b>
            </div>
            <div className="hero-stat">
              <span>Direct Telegram contact</span>
              <b>CONTACT</b>
            </div>
            <p className="tiny muted mt-2 mb-0">
              Register once — receive a unique referral ID and a prefilled introduction message.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------ purpose ----------------------------- */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2>What this website does</h2>
            <p>
              Crypto markets move fast and the tooling around them is noisy. We exist to slow the decision down: clear
              explanations of what tools exist, honest education about risk, and a straightforward way to reach a real
              person if you want to go further.
            </p>
          </div>
          <div className="grid grid-3">
            <div className="card">
              <h3>
                <span className="card-icon">1</span> Discover
              </h3>
              <p>
                Browse information about trading bots, monitoring tools and research services — described accurately,
                without invented performance claims.
              </p>
            </div>
            <div className="card">
              <h3>
                <span className="card-icon blue">2</span> Educate
              </h3>
              <p>
                Read research explainers on market risk, signals, wallet security and how to evaluate crypto tools like a
                professional skeptic.
              </p>
            </div>
            <div className="card">
              <h3>
                <span className="card-icon">3</span> Connect
              </h3>
              <p>
                Register once to get a unique referral ID, then reach our supervisor directly on Telegram with your ID
                prefilled — you press Send yourself.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------- tools overview ------------------------ */}
      <section className="section section-alt">
        <div className="container">
          <div className="section-head">
            <h2>Trading tools overview</h2>
            <p>
              A snapshot of the categories we cover. Specific product capabilities, pricing and availability are
              confirmed with our supervisor before publication.
            </p>
          </div>
          <div className="grid grid-3">
            {TOOL_CARDS.map((c) => (
              <div className="card" key={c.title}>
                <h3>
                  <span className={`card-icon ${c.blue ? "blue" : ""}`} aria-hidden="true">
                    {c.icon}
                  </span>
                  {c.title}
              </h3>
                <p>{c.text}</p>
              </div>
            ))}
          </div>
          <p className="center mt-4">
            <Link to="/crypto-tools" className="btn btn-secondary">
              See full tool details
            </Link>
          </p>
        </div>
      </section>

      {/* ------------------------------ research ---------------------------- */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2>Crypto research &amp; educational resources</h2>
            <p>
              Written to inform, not to persuade. Every article distinguishes clearly between education and financial
              advice — and we give neither.
            </p>
          </div>
          <div className="grid grid-3">
            <div className="card">
              <span className="badge badge-blue">Research</span>
              <h3 className="mt-2">Understanding market research</h3>
              <p>How on-chain data, order flow and sentiment reports are produced — and what they can't tell you.</p>
            </div>
            <div className="card">
              <span className="badge badge-red">Risk</span>
              <h3 className="mt-2">Trading risks explained</h3>
              <p>Volatility, leverage, liquidation, scams and why past performance means nothing about tomorrow.</p>
            </div>
            <div className="card">
              <span className="badge badge-green">Education</span>
              <h3 className="mt-2">Evaluating crypto tools</h3>
              <p>A repeatable checklist for judging bots, signal groups and dashboards on evidence rather than marketing.</p>
            </div>
          </div>
          <p className="center mt-4">
            <Link to="/crypto-research" className="btn btn-secondary">
              Read the research library
            </Link>
          </p>
        </div>
      </section>

      {/* -------------------------------- FAQ ------------------------------- */}
      <section className="section section-alt">
        <div className="container" style={{ maxWidth: 820 }}>
          <div className="section-head">
            <h2>Frequently asked questions</h2>
          </div>
          {FAQS.map((f) => (
            <details className="faq-item" key={f.q}>
              <summary>{f.q}</summary>
              <div className="faq-body">{f.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* ----------------------------- CTA + risk --------------------------- */}
      <section className="section">
        <div className="container center">
          <h2>Ready to look deeper?</h2>
          <p className="muted" style={{ maxWidth: "60ch", margin: "0 auto" }}>
            Register to receive your unique referral ID and a prefilled message you can send to our supervisor on
            Telegram. Registration is free and you can unsubscribe at any time.
          </p>
          <div className="hero-actions" style={{ justifyContent: "center" }}>
            <Link to="/get-started" className="btn btn-primary">
              Get Started
            </Link>
            <Link to="/crypto-tools" className="btn btn-secondary">
              Explore Crypto Tools
            </Link>
          </div>
          <div className="notice mt-4" style={{ textAlign: "left", maxWidth: 760, margin: "36px auto 0" }}>
            <strong>Risk disclaimer:</strong> Cryptocurrency trading is speculative and carries a high risk of loss.
            Tools, bots and signals do not remove market risk. Nothing here is financial advice, and no returns or
            profits are guaranteed. Only risk what you can afford to lose. Contact: @{telegram}.
          </div>
        </div>
      </section>
    </>
  );
}
