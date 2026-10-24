// Verification script (dashboard setup phase): exercises the real UI against the local dev server.
// - /admin/setup first-run state + wrong-token rejection in the form
// - registers a clearly-labeled TEST lead through the real form
// - clicks the Telegram button with t.me intercepted (no real message sent)
// - confirms duplicate registration returns the same referral ID
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const results = [];
function check(name, cond, extra = "") {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

const browser = await chromium.launch({
  executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

let telegramUrl = null;
await ctx.route("**/*", (route) => {
  const u = route.request().url();
  if (u.startsWith("https://t.me/")) {
    telegramUrl = u;
    return route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>blocked-for-test</body></html>" });
  }
  return route.continue();
});

const page = await ctx.newPage();
page.on("popup", (p) => {
  if (p.url().startsWith("https://t.me/")) telegramUrl = p.url();
});

/* 1. First-run setup page renders the setup form */
await page.goto(`${BASE}/admin/setup`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const setupText = (await page.textContent("body")) || "";
check("/admin/setup shows first-run form", /setup|token|password/i.test(setupText));
await page.screenshot({ path: "artifacts/verify-setup-page.png", fullPage: true });

/* 2. Wrong token is rejected by the real form */
await page.fill("#stoken", "wrong-token-attacker");
await page.fill("#semail", "attacker@example.com");
await page.fill("#spass", "AttackerPass123");
await page.fill("#sconfirm", "AttackerPass123");
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);
const afterBad = (await page.textContent("body")) || "";
check("setup form rejects invalid token", /invalid/i.test(afterBad) && !/dashboard|overview/i.test(afterBad));

/* 3. Register the labeled test lead through the real form */
await page.goto(`${BASE}/get-started?utm_source=test_verification`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#firstName", { timeout: 15000 });
await page.fill("#firstName", "Test Demo Entry");
await page.fill("#email", "cth-test0001@example.com");
// country defaults to United States, interest defaults to Both
await page.check("#consent");
await page.click('button[type="submit"]');
await page.waitForSelector('[data-testid="referral-id"]', { timeout: 20000 });
const rid = ((await page.textContent('[data-testid="referral-id"]')) || "").trim();
check("referral ID format CTH-######", /^CTH-\d{6}$/.test(rid), rid);
check("ID is CTH-000001 (first record in fresh DB)", rid === "CTH-000001", rid);
await page.screenshot({ path: "artifacts/verify-cth-000001.png", fullPage: true });

/* 4. Telegram button: prefilled link + tracked click (t.me intercepted, nothing sent) */
await page.click('[data-testid="telegram-button"]');
await page.waitForTimeout(2500);
check(
  "Telegram link targets @Azriel_xoxo with prefilled referral ID",
  Boolean(telegramUrl && telegramUrl.includes("Azriel_xoxo") && telegramUrl.includes(rid)),
  telegramUrl || "no URL captured",
);

/* 5. Duplicate registration is idempotent (same ID, flagged duplicate) */
const dup = await page.evaluate(
  async (base) => {
    const r = await fetch(`${base}/api/public/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Test Demo Entry",
        email: "cth-test0001@example.com",
        country: "United States",
        interest: "Both",
        contactMethod: "No preference",
        consent: true,
        source: "test_verification",
      }),
    });
    return { status: r.status, body: await r.json() };
  },
  BASE,
);
check(
  "duplicate registration returns SAME ID and duplicate flag",
  dup.body?.referralId === rid && dup.body?.duplicate === true,
  `status ${dup.status}, id ${dup.body?.referralId}, duplicate ${dup.body?.duplicate}`,
);

const passed = results.filter((r) => r.pass).length;
console.log(`\nSUMMARY: ${passed}/${results.length} checks passed`);
await browser.close();
process.exit(passed === results.length ? 0 : 1);
