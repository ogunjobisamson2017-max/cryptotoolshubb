export default function PrivacyPage() {
  return (
    <section className="section">
      <div className="container prose-page">
        <span className="eyebrow">Legal</span>
        <h1>Privacy Policy</h1>
        <p className="muted">Last updated: October 2026</p>

        <div className="notice info">
          Summary: we collect the minimum needed to respond to your request — name, email, country, interest and consent
          record. We never sell your data and never ask for secrets (passwords, bank details, seed phrases, private keys,
          verification codes).
        </div>

        <h2>1. Information we collect</h2>
        <p>
          <strong>Information you provide:</strong> first name, email address, country, main interest (Trading Bots,
          Crypto Research, or Both), optional preferred contact method, and your consent record with a timestamp. When
          you register we also generate a unique referral ID linked to your entry.
        </p>
        <p>
          <strong>Information captured automatically:</strong> the referral source and campaign parameters (UTM
          parameters) present when you arrive, the page you registered from, timestamps, and Telegram button click
          events tied to your referral ID. We record basic server logs (IP address, user agent) for security and abuse
          prevention.
        </p>
        <p>
          <strong>What we do not collect:</strong> passwords, bank or card details, wallet addresses' contents, seed
          phrases, private keys, or authentication codes. Never provide these to us or to anyone claiming to represent
          CryptoToolsHubb.
        </p>

        <h2>2. How we use your information</h2>
        <ul>
          <li>To respond to your request about crypto tools, bot subscriptions and research services.</li>
          <li>To assign and maintain your unique referral ID.</li>
          <li>To attribute registrations and Telegram clicks to marketing campaigns.</li>
          <li>To send educational or promotional messages you consented to, each with a working unsubscribe mechanism.</li>
          <li>To maintain internal records (leads, verified sales, commissions) in our administrative system.</li>
          <li>To secure the service: fraud prevention, rate limiting, audit logging of administrative actions.</li>
        </ul>

        <h2>3. Legal basis &amp; consent</h2>
        <p>
          We process your data because you gave explicit consent at registration, and to take steps you requested before
          entering a contract. You may withdraw consent at any time by unsubscribing or contacting us — withdrawal does
          not affect prior lawful processing.
        </p>

        <h2>4. Sharing</h2>
        <p>
          We do not sell or rent personal data. We share it only with service providers strictly necessary to operate
          the service (hosting, database, email delivery), bound to protect it, or where required by law. Marketing
          campaign data is aggregated before reporting.
        </p>

        <h2>5. Retention &amp; deletion</h2>
        <p>
          Lead records are kept while your registration is active and for a reasonable period afterwards for
          record-keeping, unless you request deletion first. You can request deletion of your personal data at any time
          via the Contact page; we will honor it unless retention is legally required.
        </p>

        <h2>6. Cookies &amp; tracking</h2>
        <p>
          The public site uses no advertising or third-party tracking cookies. A strictly necessary session cookie is
          used only for administrator sign-in. Campaign attribution uses first-party URL parameters and session storage,
          not cross-site trackers.
        </p>

        <h2>7. Security</h2>
        <p>
          Data is stored in an access-controlled database; administrative access requires authentication with
          salted, iterated password hashing and server-side session validation. No method of transmission or storage is
          100% secure, but we apply industry-standard protections and least-privilege access.
        </p>

        <h2>8. Your rights</h2>
        <p>
          Depending on your location, you may have rights to access, correct, delete, or port your data, and to opt out
          of promotional communications. US residents may also have rights under applicable state privacy laws. To
          exercise any right, use the Contact page or the unsubscribe link in any message.
        </p>

        <h2>9. Children</h2>
        <p>CryptoToolsHubb is for adults aged 18 and over. We do not knowingly collect data from minors.</p>

        <h2>10. Changes &amp; contact</h2>
        <p>
          We will update this page when practices change. Questions or data requests: use the Contact page or the
          Telegram contact provided there.
        </p>
      </div>
    </section>
  );
}
