import { Link, useOutletContext } from "react-router-dom";
import type { PublicConfig } from "../layouts/PublicLayout";

const PLACEHOLDER = (label: string) => (
  <span className="badge badge-amber" title="Replace once the supervisor confirms this detail">
    {label}
  </span>
);

export default function ToolsPage() {
  const cfg = useOutletContext<PublicConfig | null>();

  return (
    <>
      <section className="hero">
        <div className="container">
          <span className="eyebrow">Tools</span>
          <h1>Crypto Trading Tools</h1>
          <p className="hero-sub">
            An honest overview of the tool categories we cover. Where a capability, price or performance figure has not
            been verified with our supervisor, we show a placeholder instead of inventing one.
          </p>
          <div className="hero-actions">
            <Link to="/get-started" className="btn btn-primary">
              Get Started
            </Link>
            <Link to="/crypto-research" className="btn btn-secondary">
              Research library
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2>Trading tools</h2>
            <p>Automation and execution helpers traders use to act on rules rather than emotion.</p>
          </div>
          <div className="grid grid-2">
            <div className="card">
              <h3>
                <span className="card-icon">🤖</span> Trading bots
              </h3>
              <p>
                Rule-based automation: bots execute entries, exits and position sizing according to parameters you
                configure. They remove emotion but do not remove risk — a bot follows your rules even when the market
                turns against them.
              </p>
              <p className="mt-2">
                <strong>Before subscribing, confirm:</strong> which exchanges are supported, whether keys are API-scoped
                (trade-only, never withdrawal-enabled), fee treatment, and what happens if the bot loses connectivity.
              </p>
            </div>
            <div className="card">
              <h3>
                <span className="card-icon blue">⚙️</span> Subscription details
              </h3>
              <dl className="kv">
                <dt>Plans &amp; pricing</dt>
                <dd>{PLACEHOLDER("Pending supervisor confirmation")}</dd>
                <dt>Billing period</dt>
                <dd>{PLACEHOLDER("Pending supervisor confirmation")}</dd>
                <dt>Trial / refund policy</dt>
                <dd>{PLACEHOLDER("Pending supervisor confirmation")}</dd>
                <dt>Supported exchanges</dt>
                <dd>{PLACEHOLDER("Pending supervisor confirmation")}</dd>
                <dt>Who it's for</dt>
                <dd>Adults comfortable with the risk of automated trading.</dd>
              </dl>
              <p className="tiny muted mt-2">
                We publish prices only after they're confirmed directly. Ask on Telegram for current terms.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-head">
            <h2>Market monitoring</h2>
            <p>Stay informed without staring at charts all day.</p>
          </div>
          <div className="grid grid-3">
            <div className="card">
              <h3>Price &amp; volatility alerts</h3>
              <p>Threshold and percentage-move notifications across watched markets so you choose when to pay attention.</p>
            </div>
            <div className="card">
              <h3>Volume &amp; liquidity feeds</h3>
              <p>Unusual volume and thin-book conditions are where slippage and manipulation live. Monitoring them is
                basic hygiene.</p>
            </div>
            <div className="card">
              <h3>On-chain &amp; sentiment signals</h3>
              <p>Exchange flows, whale movement and funding rates add context. They are inputs to judgment, not
                predictions.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2>Trading signals &amp; research</h2>
            <p>
              A "signal" is a suggestion that conditions may favor a trade — an entry idea with parameters, not a
              guarantee. Treat every signal as a hypothesis you still have to evaluate.
            </p>
          </div>
          <div className="grid grid-2">
            <div className="card">
              <h3>
                <span className="card-icon">📡</span> Signals
              </h3>
              <p>
                Signals typically include an asset, direction, entry zone, stop level and target. The useful questions:
                <em> what data produces them, how often they're wrong, and whether results are published with full
                methodology</em> — including losses.
              </p>
              <p className="tiny muted">
                We do not publish win rates or performance statistics unless they are verified and auditable.
              </p>
            </div>
            <div className="card">
              <h3>
                <span className="card-icon blue">🔬</span> Research reports
              </h3>
              <p>
                Market structure notes, asset primers and tool evaluations written for comprehension — definitions,
                methodology, and the limitations stated plainly.
              </p>
              <Link className="btn btn-secondary btn-sm mt-2" to="/crypto-research">
                Browse research
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container" style={{ maxWidth: 820 }}>
          <h2>Subscription information</h2>
          <div className="notice info">
            <strong>Placeholder section.</strong> Exact product names, capabilities, prices and terms will be published
            here once confirmed with the supervisor. Nothing on this page should be read as a claim about a specific
            product's features or performance.
          </div>
          <div className="grid grid-2 mt-3">
            <div className="card">
              <h3>How to get current terms</h3>
              <p>
                Register on the Get Started page, then message the supervisor on Telegram with your referral ID. You'll
                receive current plans, pricing and availability directly.
              </p>
              <Link className="btn btn-primary btn-sm" to="/get-started">
                Get your referral ID
              </Link>
            </div>
            <div className="card">
              <h3>What we will never claim</h3>
              <ul className="muted small" style={{ paddingLeft: 18 }}>
                <li>Guaranteed profits or returns</li>
                <li>Verified performance stats we haven't seen</li>
                <li>Testimonials we haven't collected with consent</li>
                <li>Regulatory approvals or affiliations</li>
              </ul>
            </div>
          </div>
          <div className="notice mt-3">
            <strong>Risk reminder:</strong> subscriptions do not reduce market risk. Automated tools can lose money
            quickly, especially in volatile or illiquid conditions. Never fund anything with money you can't afford to
            lose.
          </div>
        </div>
      </section>
    </>
  );
}
