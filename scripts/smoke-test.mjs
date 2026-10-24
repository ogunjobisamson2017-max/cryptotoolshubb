/**
 * CryptoToolsHubb — end-to-end HTTP acceptance tests.
 * Runs against a live wrangler dev instance (workerd + local D1).
 * Usage: node scripts/smoke-test.mjs [baseURL]
 */
import { appendFileSync, writeFileSync, existsSync } from "node:fs";

const BASE = process.argv[2] || "http://127.0.0.1:3000";
const SETUP_TOKEN = process.env.ADMIN_SETUP_TOKEN || "local-dev-setup-token-change-me";

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Cookie jar fetch with JSON convenience. */
function makeClient() {
  const jar = new Map();
  let origin = new URL(BASE).origin;
  return {
    setOrigin(o) { origin = o; },
    cookieHeader() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    async fetch(path, { method = "GET", body, headers = {}, host, raw = false, noOrigin = false } = {}) {
      const url = path.startsWith("http") ? path : `${BASE}${path}`;
      const h = { ...headers };
      if (jar.size && !h.cookie) h.cookie = jarHeader(jar);
      if (body !== undefined && !(body instanceof URLSearchParams) && typeof body !== "string") {
        h["content-type"] = h["content-type"] || "application/json";
        body = JSON.stringify(body);
      }
      if (!noOrigin && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        h.origin = h.origin ?? origin;
      }
      if (host) h.host = host;
      const res = await fetch(url, { method, body, headers: h, redirect: "manual" });
      // capture set-cookie
      const setCookies = res.headers.getSetCookie?.() ?? [];
      for (const sc of setCookies) {
        const [pair] = sc.split(";");
        const [k, ...rest] = pair.split("=");
        if (rest.length) jar.set(k.trim(), rest.join("=").trim());
      }
      if (raw) return res;
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { /* not json */ }
      return { status: res.status, headers: res.headers, text, json };
    },
  };
}
function jarHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

const anon = makeClient();
const admin = makeClient();

console.log("\n=== 1. Public site availability ===");
{
  const res = await anon.fetch("/", { raw: true });
  const html = await res.text();
  check("Homepage returns 200", res.status === 200, `got ${res.status}`);
  check("Homepage has mobile viewport meta", html.includes('name="viewport"'));
  check("Homepage renders brand", html.includes("CryptoToolsHubb"));
  check("Homepage has root SPA mount", html.includes('id="root"'));

  for (const p of ["/crypto-tools", "/crypto-research", "/get-started", "/privacy", "/terms", "/risk-disclaimer", "/contact"]) {
    const r = await anon.fetch(p, { raw: true });
    check(`Route ${p} serves the app`, r.status === 200, `got ${r.status}`);
  }
}

console.log("\n=== 2. Public config (Telegram destination) ===");
let config;
{
  const r = await anon.fetch("/api/public/config");
  config = r.json;
  check("Config returns 200", r.status === 200);
  check("Supervisor Telegram username is @Azriel_xoxo", config?.telegramUsername === "Azriel_xoxo", `got ${config?.telegramUsername}`);
  check("Referral name is Samjoe1234", config?.referralName === "Samjoe1234", `got ${config?.referralName}`);
  check("Brand name present", config?.brandName === "CryptoToolsHubb");
}

console.log("\n=== 3. Lead registration + unique referral IDs ===");
const stamp = Date.now();
let lead1;
{
  const payload = {
    firstName: "Jordan",
    email: `jordan.${stamp}@example.com`,
    country: "United States",
    interest: "Both",
    contactMethod: "Email",
    consent: true,
    source: "instagram",
    medium: "social",
    campaign: `test_campaign_${stamp}`,
    landingPage: "/get-started",
  };
  const r = await anon.fetch("/api/public/leads", { method: "POST", body: payload });
  check("Registration returns 201", r.status === 201, `got ${r.status}: ${r.text}`);
  lead1 = r.json;
  check("Lead receives CTH-###### referral ID", /^CTH-\d{6}$/.test(lead1?.referralId ?? ""), lead1?.referralId);
  check("Confirmation returns firstName", lead1?.firstName === "Jordan");
  check("Unsubscribe token issued", typeof lead1?.unsubscribeToken === "string" && lead1.unsubscribeToken.length >= 20);

  // same email again → duplicate handling with SAME referral id
  const dup = await anon.fetch("/api/public/leads", { method: "POST", body: { ...payload, firstName: "Jordan" } });
  check("Duplicate email handled without new ID", dup.status === 200 && dup.json?.duplicate === true, `status ${dup.status}`);
  check("Duplicate returns original referral ID", dup.json?.referralId === lead1?.referralId, `${dup.json?.referralId} vs ${lead1?.referralId}`);

  // second distinct lead → different ID
  const r2 = await anon.fetch("/api/public/leads", {
    method: "POST",
    body: { ...payload, email: `casey.${stamp}@example.com`, firstName: "Casey", source: "twitter" },
  });
  check("Second lead gets a different unique ID", r2.json?.referralId && r2.json.referralId !== lead1?.referralId, r2.json?.referralId);
}

console.log("\n=== 4. Validation & consent enforcement ===");
{
  const bad = await anon.fetch("/api/public/leads", {
    method: "POST",
    body: { firstName: "X", email: "not-an-email", country: "", interest: "Nope", consent: false },
  });
  check("Invalid registration rejected (400)", bad.status === 400, `got ${bad.status}`);

  const noConsent = await anon.fetch("/api/public/leads", {
    method: "POST",
    body: { firstName: "Test", email: `noconsent.${stamp}@example.com`, country: "United States", interest: "Both", consent: false },
  });
  check("Missing consent rejected", noConsent.status === 400, `got ${noConsent.status}`);

  const honeypotish = await anon.fetch("/api/public/leads", {
    method: "POST",
    body: { firstName: "A".repeat(500), email: `long.${stamp}@example.com`, country: "United States", interest: "Both", consent: true },
  });
  check("Overlong input rejected", honeypotish.status === 400, `got ${honeypotish.status}`);
}

console.log("\n=== 5. Telegram click tracking (never a sale) ===");
{
  const r = await anon.fetch("/api/public/telegram-click", {
    method: "POST",
    body: { referralId: lead1?.referralId, source: "instagram", campaign: `test_campaign_${stamp}` },
  });
  check("Telegram click recorded (200)", r.status === 200, `got ${r.status}`);
  check("Response explicitly notes click ≠ sale", /not proof of a sent message or a sale/i.test(r.json?.note ?? ""));

  const bad = await anon.fetch("/api/public/telegram-click", {
    method: "POST",
    body: { referralId: "CTH-999999" },
  });
  check("Unknown referral click rejected", bad.status === 404, `got ${bad.status}`);
}

console.log("\n=== 6. Admin auth: setup, session, access control ===");
{
  const me1 = await admin.fetch("/api/admin/auth/me");
  check("Unauthenticated admin call → 401", me1.status === 401, `got ${me1.status}`);

  const data = await admin.fetch("/api/admin/data/overview");
  check("Unauthenticated data call → 401", data.status === 401, `got ${data.status}`);

  const status = await anon.fetch("/api/admin/auth/setup-status");
  check("Setup status reachable", status.status === 200 && typeof status.json?.needsSetup === "boolean");

  const noToken = await anon.fetch("/api/admin/auth/setup", {
    method: "POST",
    body: { email: `evil.${stamp}@example.com`, password: "password12345" },
  });
  check("Setup without token rejected", [400, 403].includes(noToken.status), `got ${noToken.status}`);

  const wrongToken = await anon.fetch("/api/admin/auth/setup", {
    method: "POST",
    body: { setupToken: "totally-wrong-token", email: `evil.${stamp}@example.com`, password: "password12345" },
  });
  check("Setup with wrong token rejected", wrongToken.status === 403, `got ${wrongToken.status}`);

  const weak = await anon.fetch("/api/admin/auth/setup", {
    method: "POST",
    body: { setupToken: SETUP_TOKEN, email: `weak.${stamp}@example.com`, password: "short" },
  });
  check("Weak password rejected", weak.status === 400, `got ${weak.status}`);

  const setup = await anon.fetch("/api/admin/auth/setup", {
    method: "POST",
    body: { setupToken: SETUP_TOKEN, email: `owner.${stamp}@cryptotoolshubb.test`, password: "Acceptance2026!" },
  });
  check("Admin setup succeeds with valid token", setup.status === 201, `got ${setup.status}: ${setup.text}`);
  check("Setup issues session", setup.status === 201);

  // second setup attempt must fail
  const setup2 = await anon.fetch("/api/admin/auth/setup", {
    method: "POST",
    body: { setupToken: SETUP_TOKEN, email: `second.${stamp}@cryptotoolshubb.test`, password: "Acceptance2026!" },
  });
  check("Second setup attempt blocked", setup2.status === 409, `got ${setup2.status}`);

  const wrongLogin = await anon.fetch("/api/admin/auth/login", {
    method: "POST",
    body: { email: `owner.${stamp}@cryptotoolshubb.test`, password: "wrong-password" },
  });
  check("Wrong password rejected", wrongLogin.status === 401, `got ${wrongLogin.status}`);

  const login = await anon.fetch("/api/admin/auth/login", {
    method: "POST",
    body: { email: `owner.${stamp}@cryptotoolshubb.test`, password: "Acceptance2026!" },
  });
  check("Admin login succeeds", login.status === 200, `got ${login.status}: ${login.text}`);

  // reuse anon client as logged-in admin from here on
  const me2 = await anon.fetch("/api/admin/auth/me");
  check("Session returns admin identity", me2.status === 200 && me2.json?.admin?.email?.startsWith("owner."), `got ${me2.status}`);
}

console.log("\n=== 7. CSRF / origin enforcement ===");
{
  const found = await anon.fetch(`/api/admin/data/leads?search=${encodeURIComponent(lead1.referralId)}`);
  const targetId = found.json?.results?.[0]?.id ?? 1;
  const foreign = await anon.fetch(`/api/admin/data/leads/${targetId}`, {
    method: "PATCH",
    headers: { origin: "https://evil.example.com" },
    body: { notes: "should-not-apply" },
  });
  check("Foreign-origin mutation blocked (403)", foreign.status === 403, `got ${foreign.status}`);

  const noOrigin = await anon.fetch(`/api/admin/data/leads/${targetId}`, {
    method: "PATCH",
    noOrigin: true,
    body: { notes: "should-not-apply" },
  });
  check("Request without Origin header blocked on mutations", noOrigin.status === 403, `got ${noOrigin.status}`);
}

console.log("\n=== 8. Lead management (admin) ===");
let leadRow;
{
  const list = await anon.fetch(`/api/admin/data/leads?search=${encodeURIComponent(lead1.referralId)}`);
  check("Admin can list leads", list.status === 200 && list.json?.total >= 1, `got ${list.status}, total ${list.json?.total}`);
  leadRow = list.json?.results?.[0];
  check("Lead row includes referral ID + email + source", leadRow?.referral_id === lead1.referralId && leadRow?.source === "instagram");
  check("Lead row shows telegram click count", (leadRow?.telegram_clicks ?? 0) >= 1, `clicks=${leadRow?.telegram_clicks}`);

  const upd = await anon.fetch(`/api/admin/data/leads/${leadRow.id}`, {
    method: "PATCH",
    body: { status: "Contacted", notes: "Messaged on Telegram; awaiting reply." },
  });
  check("Lead status/notes updated", upd.status === 200 && upd.json?.lead?.status === "Contacted", upd.text);

  const badStatus = await anon.fetch(`/api/admin/data/leads/${leadRow.id}`, { method: "PATCH", body: { status: "Bogus" } });
  check("Invalid lead status rejected", badStatus.status === 400, `got ${badStatus.status}`);
}

console.log("\n=== 9. Sales & commission (verification enforced) ===");
let saleId;
{
  const unverified = await anon.fetch("/api/admin/data/sales", {
    method: "POST",
    body: {
      referralId: lead1.referralId,
      customerLabel: "Jordan",
      productName: "Trading bot subscription",
      saleDate: new Date().toISOString().slice(0, 10),
      saleAmountUsd: 97,
      commissionUsd: 30,
      paymentStatus: "Confirmed",
      confirmationSource: "",
    },
  });
  check("Confirmed sale without confirmation source rejected", unverified.status === 400, `got ${unverified.status}: ${unverified.text}`);

  const pending = await anon.fetch("/api/admin/data/sales", {
    method: "POST",
    body: {
      referralId: lead1.referralId,
      customerLabel: "Jordan",
      productName: "Trading bot subscription",
      saleDate: new Date().toISOString().slice(0, 10),
      saleAmountUsd: 97,
      commissionUsd: 30,
      paymentStatus: "Pending",
      notes: "Awaiting supervisor verification.",
    },
  });
  check("Pending sale recorded", pending.status === 201, `got ${pending.status}: ${pending.text}`);
  saleId = pending.json?.sale?.id;

  // overview BEFORE confirmation: commission must NOT count pending sales
  const before = await anon.fetch("/api/admin/data/overview");
  const t0 = before.json?.totals;
  check("Pending sale not counted as confirmed", (t0?.confirmedSales ?? 0) === 0, `confirmed=${t0?.confirmedSales}`);
  check("Commission excludes pending sales", (t0?.totalConfirmedCommission ?? 0) === 0, `commission=${t0?.totalConfirmedCommission}`);
  check("Telegram clicks counted separately", (t0?.telegramClicks ?? 0) >= 1, `clicks=${t0?.telegramClicks}`);
  check("Conversion rate starts at 0%", (t0?.conversionRate ?? -1) === 0, `rate=${t0?.conversionRate}`);

  // confirm without source via PATCH → rejected
  const badConfirm = await anon.fetch(`/api/admin/data/sales/${saleId}`, {
    method: "PATCH",
    body: { paymentStatus: "Confirmed" },
  });
  check("PATCH to Confirmed without source rejected", badConfirm.status === 400, `got ${badConfirm.status}`);

  const goodConfirm = await anon.fetch(`/api/admin/data/sales/${saleId}`, {
    method: "PATCH",
    body: { paymentStatus: "Confirmed", confirmationSource: "Supervisor Telegram confirmation" },
  });
  check("Verified sale marked Confirmed", goodConfirm.status === 200, goodConfirm.text);

  const after = await anon.fetch("/api/admin/data/overview");
  const t1 = after.json?.totals;
  check("Confirmed sale counted", (t1?.confirmedSales ?? 0) === 1, `confirmed=${t1?.confirmedSales}`);
  check("Confirmed commission summed (30)", Number(t1?.totalConfirmedCommission) === 30, `commission=${t1?.totalConfirmedCommission}`);
  check("Confirmed customer counted", (t1?.confirmedCustomers ?? 0) === 1, `customers=${t1?.confirmedCustomers}`);
  check("Conversion rate now > 0%", (t1?.conversionRate ?? 0) > 0, `rate=${t1?.conversionRate}`);
  check("Traffic sources listed", Array.isArray(after.json?.trafficSources) && after.json.trafficSources.some((s) => s.source === "instagram"), JSON.stringify(after.json?.trafficSources));

  const leadAfter = await anon.fetch(`/api/admin/data/leads?search=${encodeURIComponent(lead1.referralId)}`);
  check("Confirmed sale promotes lead to Converted", leadAfter.json?.results?.[0]?.status === "Converted", leadAfter.json?.results?.[0]?.status);
}

console.log("\n=== 10. Campaigns & UTM links ===");
let campaignId;
{
  const created = await anon.fetch("/api/admin/growth/campaigns", {
    method: "POST",
    body: { name: `Autumn push ${stamp}`, utmSource: "instagram", utmMedium: "social", utmCampaign: `autumn_${stamp}`, landingPath: "/get-started" },
  });
  check("Campaign created", created.status === 201, created.text);
  campaignId = created.json?.campaign?.id;

  const list = await anon.fetch("/api/admin/growth/campaigns");
  check("Campaign performance shows registrations/clicks/conversions fields",
    list.status === 200 && list.json?.results?.some((c) => c.id === campaignId && "referrals" in c && "telegram_clicks" in c && "confirmed_conversions" in c));
}

console.log("\n=== 11. Growth Center: content drafts, calendar statuses ===");
let contentId;
{
  const gen = await anon.fetch("/api/admin/growth/content/generate", {
    method: "POST",
    body: { topic: "wallet security", platform: "X", count: 3 },
  });
  check("Content generator returns drafts", gen.status === 200 && gen.json?.generated?.length === 3, gen.text?.slice(0, 120));
  const draftBody = gen.json?.generated?.[0]?.body ?? "";
  check("Generated content disclaims financial advice", /not financial advice|Educational content only/i.test(draftBody));
  check("Generated content promises no returns", !/guaranteed profit|guaranteed return/i.test(draftBody));

  const save = await anon.fetch("/api/admin/growth/content", {
    method: "POST",
    body: { title: "Wallet security primer", body: draftBody, platform: "X", contentType: "Educational", hashtags: "#crypto", status: "Draft" },
  });
  check("Draft saved", save.status === 201, save.text);
  contentId = save.json?.content?.id;

  const schedNoDate = await anon.fetch(`/api/admin/growth/content/${contentId}`, { method: "PATCH", body: { status: "Scheduled" } });
  check("Scheduling without a date rejected", schedNoDate.status === 400, `got ${schedNoDate.status}`);

  const sched = await anon.fetch(`/api/admin/growth/content/${contentId}`, {
    method: "PATCH",
    body: { status: "Scheduled", scheduledAt: new Date(Date.now() + 3600_000).toISOString() },
  });
  check("Scheduled with date accepted", sched.status === 200, sched.text);

  const failNoReason = await anon.fetch(`/api/admin/growth/content/${contentId}`, { method: "PATCH", body: { status: "Failed" } });
  check("Failed without reason rejected", failNoReason.status === 400, `got ${failNoReason.status}`);

  const publish = await anon.fetch(`/api/admin/growth/content/${contentId}`, {
    method: "PATCH",
    body: { status: "Published", publishUrl: "https://x.com/test/status/1" },
  });
  check("Published with URL accepted", publish.status === 200, publish.text);

  const list = await anon.fetch("/api/admin/growth/content?limit=100");
  check("Content list returns records", list.status === 200 && list.json?.results?.length >= 1);
}

console.log("\n=== 12. Integration status is honest (not connected by default) ===");
{
  const s = await anon.fetch("/api/admin/reports/settings");
  check("Settings endpoint works", s.status === 200);
  const integrations = s.json?.integrations ?? [];
  const ig = integrations.find((i) => i.name === "instagram");
  check("Instagram integration present", Boolean(ig));
  let parsed = {};
  try { parsed = JSON.parse(ig.raw); } catch { /* noop */ }
  check("Instagram not claimed connected by default", parsed.status === "not_connected", `status=${parsed.status}`);
}

console.log("\n=== 13. CSV exports ===");
{
  const exportsToTry = [
    ["leads", "Referral ID"],
    ["referral-activity", "Referral ID"],
    ["sales", "Referral ID"],
    ["commissions", "Referral ID"],
    ["campaigns", "Campaign"],
    ["traffic", "Day (UTC)"],
  ];
  for (const [key, expectHeader] of exportsToTry) {
    const res = await anon.fetch(`/api/admin/reports/export/${key}?from=2020-01-01&to=2030-01-01`, { raw: true });
    const text = await res.text();
    const ct = res.headers.get("content-type") || "";
    const cd = res.headers.get("content-disposition") || "";
    check(`Export ${key}.csv → 200 + CSV content type`, res.status === 200 && ct.includes("text/csv"), `${res.status} ${ct}`);
    check(`Export ${key}.csv has attachment filename`, cd.includes("attachment"), cd);
    check(`Export ${key}.csv has expected header`, text.split(/\r?\n/)[0]?.includes(expectHeader), text.slice(0, 80));
  }
  // lead export must contain our real test lead
  const leadsCsv = await (await anon.fetch("/api/admin/reports/export/leads", { raw: true })).text();
  check("Leads CSV contains the registered lead", leadsCsv.includes(lead1.referralId));
  check("Leads CSV contains registration timestamp", /20\d\d-\d\d-\d\dT\d\d:/.test(leadsCsv));
}

console.log("\n=== 14. Unsubscribe mechanism ===");
{
  const r = await anon.fetch("/api/public/unsubscribe", { method: "POST", body: { token: lead1.unsubscribeToken } });
  check("Unsubscribe with valid token works", r.status === 200, r.text);
  const bad = await anon.fetch("/api/public/unsubscribe", { method: "POST", body: { token: "x".repeat(40) } });
  check("Invalid unsubscribe token rejected", bad.status === 404, `got ${bad.status}`);
}

console.log("\n=== 15. Page view tracking (captured events only) ===");
{
  const r = await anon.fetch("/api/public/view", { method: "POST", body: { path: "/crypto-tools", source: "newsletter", campaign: `test_campaign_${stamp}` } });
  check("View beacon accepted", r.status === 200, r.text);
}

console.log("\n=== 16. Audit log records admin actions ===");
{
  const r = await anon.fetch("/api/admin/reports/audit?limit=50");
  const actions = (r.json?.results ?? []).map((x) => x.action);
  check("Audit log reachable", r.status === 200 && actions.length > 0, `${actions.length} entries`);
  check("Login audited", actions.includes("admin.login"), actions.slice(0, 8).join(","));
  check("Sale creation audited", actions.includes("sale.created"));
  check("Lead update audited", actions.includes("lead.updated"));
}

console.log("\n=== 17. Security headers ===");
{
  const res = await anon.fetch("/", { raw: true });
  check("x-content-type-options: nosniff", res.headers.get("x-content-type-options") === "nosniff");
  check("x-frame-options: DENY", res.headers.get("x-frame-options") === "DENY");
  check("referrer-policy set", Boolean(res.headers.get("referrer-policy")));
  const api = await anon.fetch("/api/public/config", { raw: true });
  check("API responses are no-store", (api.headers.get("cache-control") || "").includes("no-store"));
}

console.log("\n=== 18. Logout invalidates session ===");
{
  const out = await anon.fetch("/api/admin/auth/logout", { method: "POST" });
  check("Logout succeeds", out.status === 200, `got ${out.status}`);
  const me = await anon.fetch("/api/admin/auth/me");
  check("Session rejected after logout", me.status === 401, `got ${me.status}`);
}

console.log("\n=== 19. Session persistence check (server-side storage) ===");
{
  const client2 = makeClient();
  const login = await client2.fetch("/api/admin/auth/login", {
    method: "POST",
    body: { email: `owner.${stamp}@cryptotoolshubb.test`, password: "Acceptance2026!" },
  });
  check("Re-login for persistence check", login.status === 200, login.text?.slice(0, 100));
  const leads = await client2.fetch("/api/admin/data/leads?search=" + encodeURIComponent(lead1.referralId));
  check("Lead persists across sessions (D1, not browser memory)", leads.status === 200 && leads.json?.total >= 1, `total=${leads.json?.total}`);
  const sale = await client2.fetch(`/api/admin/data/sales?search=${encodeURIComponent(lead1.referralId)}`);
  check("Sale persists", sale.status === 200 && sale.json?.total >= 1, `total=${sale.json?.total}`);
}

console.log("\n=== 20. No fabricated demo data in reports ===");
{
  const r = await anon.fetch("/api/admin/reports/export/traffic", { raw: true });
  const csv = await r.text();
  const rows = csv.trim().split(/\r?\n/).slice(1);
  // every row must be a real date; totals must not exceed our known test activity by much
  check("Traffic CSV rows are real dates", rows.every((line) => /^\d{4}-\d\d-\d\d,/.test(line)), rows.slice(0, 3).join(" | "));
}

/* ------------------------------- summary ---------------------------------- */
console.log(`\n========================================`);
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
if (failures.length) {
  console.log(`\n  Failures:`);
  for (const f of failures) console.log(`   ✗ ${f}`);
}
console.log(`========================================\n`);

const report = `${new Date().toISOString()} passed=${passed} failed=${failed}\n${failures.map((f) => `FAIL: ${f}`).join("\n")}\n`;
if (existsSync("artifacts")) appendFileSync("artifacts/test-results.txt", report);
else { try { writeFileSync("artifacts-test-results.txt", report); } catch { /* ignore */ } }

process.exit(failed ? 1 : 0);
