export default function DisclaimerPage() {
  return (
    <section className="section">
      <div className="container prose-page">
        <span className="eyebrow">Risk</span>
        <h1>Cryptocurrency Risk Disclaimer</h1>

        <div className="notice">
          <strong>Read this before using any information on this site.</strong> Cryptocurrency trading and investing
          carry a high level of risk, including the risk of total loss of capital. Nothing on CryptoToolsHubb is a
          guarantee of any return, profit or performance outcome.
        </div>

        <h2>Market risk</h2>
        <p>
          Crypto asset prices are highly volatile and can decline rapidly and permanently. Assets can lose most or all
          of their value. Past performance — of a market, a strategy, a bot or a signal service — is not indicative of
          future results. Events such as exchange failures, protocol exploits, regulatory action and liquidity crises
          can happen without warning.
        </p>

        <h2>Leverage &amp; derivatives</h2>
        <p>
          Leveraged products amplify gains and losses equally. Small adverse price moves can liquidate a position
          before a recovery occurs. Many retail participants lose money on leveraged products. Only use leverage if you
          fully understand how liquidation works.
        </p>

        <h2>Automated trading tools &amp; bots</h2>
        <p>
          Trading bots execute your configured rules — they do not eliminate risk. Bots can fail during volatility,
          connectivity loss or exchange downtime, and can accumulate losses while unattended. Automation changes how
          risk appears; it does not reduce total risk by itself. Review and monitor any automated strategy constantly.
        </p>

        <h2>Trading signals</h2>
        <p>
          A signal is an idea, not a prediction. Signals can be wrong, delayed or fail to account for your position
          size, fees or slippage. Any published win rate or track record — including one shown by us — must be verified
          with complete methodology including losses before you rely on it. We do not publish performance statistics we
          have not verified.
        </p>

        <h2>Research &amp; educational content</h2>
        <p>
          All articles, guides and tool descriptions on this site are general education. They are not financial advice,
          not investment advice, and not a solicitation to buy or sell any asset or subscription. Content does not take
          into account your personal circumstances. Seek advice from an independent, licensed professional before
          acting.
        </p>

        <h2>No guarantees</h2>
        <ul>
          <li>No guaranteed returns, profits, or win rates are promised anywhere on this site.</li>
          <li>No specific investment performance is stated or implied.</li>
          <li>Testimonials, regulatory approvals, licenses or affiliations are not claimed unless verifiably true.</li>
          <li>Information may contain errors or become outdated; verify before relying on it.</li>
        </ul>

        <h2>Security risk</h2>
        <p>
          Self-custody carries risks: lost seed phrases mean lost funds; exposed keys or signed malicious approvals can
          drain wallets. Scams, phishing and impersonation are common in crypto. Verify every counterparty
          independently.
        </p>

        <h2>Your responsibility</h2>
        <p>
          You alone are responsible for your trading and investment decisions. Never risk funds you cannot afford to
          lose entirely. If an offer sounds guaranteed, treat it as a warning sign.
        </p>

        <p className="tiny muted mt-4">
          Disclaimer version: 2026-10-v1 · <a href="/terms">Terms of Use</a> · <a href="/privacy">Privacy Policy</a>
        </p>
      </div>
    </section>
  );
}
