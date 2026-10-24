import { Link } from "react-router-dom";

const ARTICLES = [
  {
    id: "market-research",
    tag: "Research",
    badge: "badge-blue",
    title: "Cryptocurrency market research: how it's done",
    body: [
      "Market research in crypto blends three streams: on-chain data (transfers, exchange balances, holder distribution), market microstructure (order book depth, funding rates, liquidations), and qualitative context (regulatory news, protocol upgrades, macro conditions).",
      "Each stream has blind spots. On-chain data can't identify who controls an address. Order books show intent, not commitment — spoofed orders exist. Sentiment metrics measure what people say, not what they'll do.",
      "Good research states its methodology and its limits. When you read a report, look for: data sources named, time range disclosed, and alternative explanations considered. If a document skips methodology, its conclusions are marketing, not research.",
    ],
  },
  {
    id: "trading-risks",
    tag: "Risk",
    badge: "badge-red",
    title: "Trading risks you should price in first",
    body: [
      "Volatility: crypto can move double-digit percentages in hours. Positions can be liquidated faster than you can react, particularly with leverage.",
      "Leverage multiplies losses as fast as gains. Many retail traders lose money on leveraged products; the mechanism is designed so small adverse moves close your position.",
      "Counterparty risk: exchanges and platforms can freeze withdrawals, get hacked, or fail. Not your keys, not your coins is a cliché for a reason.",
      "Fraud risk: rug pulls, phishing, fake support agents and impersonation are rampant. Verify every URL, every contract address and every person claiming to represent a service.",
      "Liquidity risk: in thin markets, your exit may cost far more than the quote suggested. Slippage is a real cost that never appears in backtests.",
      "Never invest money you need for rent, food, healthcare or emergencies. Past performance — including a great month — says nothing about what happens next.",
    ],
  },
  {
    id: "signals",
    tag: "Education",
    badge: "badge-green",
    title: "Understanding trading signals",
    body: [
      "A signal is a trade idea: asset, direction, entry, stop, target. It might come from technical indicators, quant models, news triggers or a human analyst's judgment.",
      "Before acting on any signal, ask four questions. What is the methodology, and is it disclosed? What is the published track record, including losses? What's the win size versus loss size? And what risk parameters are you expected to apply?",
      "A signal without a stop level is an open-ended liability. A track record without losses is either short or curated. And a signal that arrives without context doesn't teach you anything — you'll never learn to trade on someone else's ideas alone.",
      "Signals are inputs. The decision — and the risk — remains yours.",
    ],
  },
  {
    id: "wallet-security",
    tag: "Security",
    badge: "badge-blue",
    title: "Wallet security fundamentals",
    body: [
      "Your seed phrase is the money. Anyone holding it controls your funds, so it never goes in cloud storage, email drafts, screenshots, or any chat — including support chats.",
      "Use a hardware wallet for meaningful balances, and verify transaction details on the device screen. Malware can rewrite a displayed address, so the screen you trust is the wallet's, not the browser's.",
      "Lock down accounts with strong unique passwords and hardware-key or app-based 2FA — SMS 2FA is the weakest option. Never reuse passwords between exchanges and email.",
      "Beware approval phishing: signing a token approval can grant an attacker unlimited spending rights on your wallet. Review what you sign, and revoke stale approvals periodically.",
      "Test recovery once. If you can't restore from your backup when calm, you can't restore it during an emergency either.",
    ],
  },
  {
    id: "evaluating-tools",
    tag: "Education",
    badge: "badge-green",
    title: "Evaluating crypto tools: a checklist",
    body: [
      "Transparency: are the team, methodology and data sources identified? Anonymous operators with guaranteed results are a red flag, not a feature.",
      "Security posture: for bots, are API keys permissioned without withdrawal rights? For platforms, is there a published security audit and a disclosure policy?",
      "Claims: any tool promising fixed returns is misrepresenting how markets work. Backtests aren't live results, and results without drawdown figures are incomplete.",
      "Costs: subscription fees, exchange fees, slippage and spread all compound. A tool that improves your gross edge by less than your costs takes nothing home.",
      "Support and terms: refund policy, data handling, and what happens to your funds or positions if the service goes offline. Read the terms before the testimonials.",
      "Independence: if the person recommending a tool also profits from your subscription, factor that incentive into their enthusiasm.",
    ],
  },
];

export default function ResearchPage() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <span className="eyebrow">Education</span>
          <h1>Crypto Research Library</h1>
          <p className="hero-sub">
            Plain-English explainers on market research, trading risk, signals, wallet security and evaluating tools.
            Written to inform your judgment — never to tell you what to buy.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="notice info" style={{ maxWidth: 860 }}>
            <strong>Educational content, not financial advice.</strong> These articles explain concepts and risks. They
            do not consider your personal circumstances and are not a recommendation to buy, sell or hold any asset.
            Cryptocurrency trading involves substantial risk of loss.
          </div>

          <div className="grid grid-1 mt-4" style={{ gap: 34 }}>
            {ARTICLES.map((a) => (
              <article className="card article" id={a.id} key={a.id} style={{ maxWidth: 860, margin: "0 auto", width: "100%" }}>
                <span className={`badge ${a.badge}`}>{a.tag}</span>
                <h2 style={{ fontSize: "1.4rem", marginTop: 12 }}>{a.title}</h2>
                {a.body.map((p, i) => (
                  <p key={i} className={i === 0 ? "lead" : undefined}>
                    {p}
                  </p>
                ))}
              </article>
            ))}
          </div>

          <div className="notice mt-4" style={{ maxWidth: 860, margin: "36px auto 0" }}>
            <strong>Final word:</strong> education reduces avoidable mistakes, but it cannot remove market risk. Crypto
            prices can fall to zero. Only engage with tools and markets you understand, and only with money you can
            afford to lose entirely.
          </div>

          <p className="center mt-4">
            <Link to="/get-started" className="btn btn-primary">
              Get Started
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
