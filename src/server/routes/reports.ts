import { Hono } from "hono";
import type { Env } from "../lib/util";
import { nowIso } from "../lib/util";
import { cleanString, dateRange, optionalString } from "../lib/validate";
import { toCsv, csvResponse } from "../lib/csv";
import { audit } from "./public";

export const reportRoutes = new Hono<{
  Bindings: Env;
  Variables: { admin: { id: number; email: string; role: string } };
}>();

function fileName(base: string): string {
  const d = new Date().toISOString().slice(0, 10);
  return `${base}-${d}.csv`;
}

async function logExport(c: {
  env: Env;
  get: (k: "admin") => { id: number; email: string };
}, what: string): Promise<void> {
  const admin = c.get("admin");
  await audit(c.env.DB, "report.exported", "report", null, what, admin.id, admin.email);
}

/** Leads CSV (date-filtered). */
reportRoutes.get("/export/leads", async (c) => {
  const q = c.req.query() as Record<string, string | undefined>;
  const { from, to } = dateRange(q);
  const where: string[] = ["1=1"];
  const args: unknown[] = [];
  if (from) { where.push("created_at >= ?"); args.push(from); }
  if (to) { where.push("created_at <= ?"); args.push(to); }
  const rows = await c.env.DB.prepare(
    `SELECT referral_id, first_name, email, country, interest, contact_method, status,
            source, medium, campaign, ref_code, unsubscribed, created_at, notes
     FROM leads WHERE ${where.join(" AND ")} ORDER BY created_at DESC`,
  )
    .bind(...args)
    .all<{ [k: string]: unknown }>();

  const csv = toCsv(
    ["Referral ID", "First name", "Email", "Country", "Interest", "Contact method", "Status", "Source", "Medium", "Campaign", "Ref code", "Unsubscribed", "Registered at (UTC)", "Notes"],
    rows.results.map((r) => [
      r.referral_id, r.first_name, r.email, r.country, r.interest, r.contact_method, r.status,
      r.source, r.medium, r.campaign, r.ref_code, r.unsubscribed ? "yes" : "no", r.created_at, r.notes,
    ]),
  );
  await logExport(c as never, `Leads CSV (${rows.results.length} rows)`);
  return csvResponse(fileName("cryptotoolshubb-leads"), csv);
});

/** Referral activity CSV: registrations + telegram click events. */
reportRoutes.get("/export/referral-activity", async (c) => {
  const q = c.req.query() as Record<string, string | undefined>;
  const { from, to } = dateRange(q);
  const where: string[] = ["1=1"];
  const args: unknown[] = [];
  if (from) { where.push("clicked_at >= ?"); args.push(from); }
  if (to) { where.push("clicked_at <= ?"); args.push(to); }
  const rows = await c.env.DB.prepare(
    `SELECT referral_id, clicked_at, source, medium, campaign, landing_page
     FROM telegram_clicks WHERE ${where.join(" AND ")} ORDER BY clicked_at DESC`,
  )
    .bind(...args)
    .all<{ [k: string]: unknown }>();

  const csv = toCsv(
    ["Referral ID", "Event", "Timestamp (UTC)", "Source", "Medium", "Campaign", "Landing page"],
    rows.results.map((r) => [r.referral_id, "telegram_click", r.clicked_at, r.source, r.medium, r.campaign, r.landing_page]),
  );
  await logExport(c as never, `Referral activity CSV (${rows.results.length} rows)`);
  return csvResponse(fileName("cryptotoolshubb-referral-activity"), csv);
});

/** Confirmed sales CSV (only verified sales). */
reportRoutes.get("/export/sales", async (c) => {
  const q = c.req.query() as Record<string, string | undefined>;
  const { from, to } = dateRange(q);
  const confirmedOnly = q.confirmedOnly !== "false";
  const where: string[] = ["1=1"];
  const args: unknown[] = [];
  if (confirmedOnly) { where.push("payment_status IN ('Confirmed','Paid')"); }
  if (from) { where.push("sale_date >= ?"); args.push(from.slice(0, 10)); }
  if (to) { where.push("sale_date <= ?"); args.push(to.slice(0, 10)); }
  const rows = await c.env.DB.prepare(
    `SELECT referral_id, customer_label, product_name, sale_date, sale_amount_usd, commission_usd,
            payment_status, confirmation_source, confirmed_at, created_at, notes
     FROM sales WHERE ${where.join(" AND ")} ORDER BY sale_date DESC`,
  )
    .bind(...args)
    .all<{ [k: string]: unknown }>();

  const csv = toCsv(
    ["Referral ID", "Customer", "Product", "Sale date", "Sale amount (USD)", "Commission (USD)", "Payment status", "Confirmation source", "Confirmed at (UTC)", "Recorded at (UTC)", "Notes"],
    rows.results.map((r) => [
      r.referral_id, r.customer_label, r.product_name, r.sale_date, r.sale_amount_usd, r.commission_usd,
      r.payment_status, r.confirmation_source, r.confirmed_at, r.created_at, r.notes,
    ]),
  );
  await logExport(c as never, `Sales CSV (${rows.results.length} rows)`);
  return csvResponse(fileName("cryptotoolshubb-sales"), csv);
});

/** Commission records CSV (verified commission only). */
reportRoutes.get("/export/commissions", async (c) => {
  const q = c.req.query() as Record<string, string | undefined>;
  const { from, to } = dateRange(q);
  const where: string[] = ["payment_status IN ('Confirmed','Paid')"];
  const args: unknown[] = [];
  if (from) { where.push("sale_date >= ?"); args.push(from.slice(0, 10)); }
  if (to) { where.push("sale_date <= ?"); args.push(to.slice(0, 10)); }
  const rows = await c.env.DB.prepare(
    `SELECT referral_id, product_name, sale_date, commission_usd, payment_status, confirmed_at, confirmation_source
     FROM sales WHERE ${where.join(" AND ")} ORDER BY sale_date DESC`,
  )
    .bind(...args)
    .all<{ [k: string]: unknown }>();

  const csv = toCsv(
    ["Referral ID", "Product", "Sale date", "Commission (USD)", "Payment status", "Confirmed at (UTC)", "Confirmation source"],
    rows.results.map((r) => [
      r.referral_id, r.product_name, r.sale_date, r.commission_usd, r.payment_status, r.confirmed_at, r.confirmation_source,
    ]),
  );
  await logExport(c as never, `Commissions CSV (${rows.results.length} rows)`);
  return csvResponse(fileName("cryptotoolshubb-commissions"), csv);
});

/** Campaign performance CSV: registrations, clicks, conversions per campaign. */
reportRoutes.get("/export/campaigns", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT c.name, c.utm_source, c.utm_medium, c.utm_campaign, c.landing_path, c.is_active,
            (SELECT COUNT(*) FROM leads l WHERE l.campaign_id = c.id) AS referral_registrations,
            (SELECT COUNT(*) FROM telegram_clicks t WHERE t.campaign = c.utm_campaign) AS telegram_clicks,
            (SELECT COUNT(*) FROM sales s JOIN leads l2 ON l2.referral_id = s.referral_id
              WHERE l2.campaign_id = c.id AND s.payment_status IN ('Confirmed','Paid')) AS confirmed_conversions,
            (SELECT COALESCE(SUM(s.commission_usd),0) FROM sales s JOIN leads l2 ON l2.referral_id = s.referral_id
              WHERE l2.campaign_id = c.id AND s.payment_status IN ('Confirmed','Paid')) AS confirmed_commission
     FROM campaigns c ORDER BY c.created_at DESC`,
  ).all<{ [k: string]: unknown }>();

  const csv = toCsv(
    ["Campaign", "UTM source", "UTM medium", "UTM campaign", "Landing path", "Active", "Referral registrations", "Telegram clicks", "Confirmed conversions", "Confirmed commission (USD)"],
    rows.results.map((r) => [
      r.name, r.utm_source, r.utm_medium, r.utm_campaign, r.landing_path, r.is_active ? "yes" : "no",
      r.referral_registrations, r.telegram_clicks, r.confirmed_conversions, r.confirmed_commission,
    ]),
  );
  await logExport(c as never, `Campaign performance CSV (${rows.results.length} rows)`);
  return csvResponse(fileName("cryptotoolshubb-campaign-performance"), csv);
});

/** Traffic by day CSV (first-party page views captured by this system). */
reportRoutes.get("/export/traffic", async (c) => {
  const q = c.req.query() as Record<string, string | undefined>;
  const { from, to } = dateRange(q);
  const where: string[] = ["1=1"];
  const args: unknown[] = [];
  if (from) { where.push("day >= ?"); args.push(from.slice(0, 10)); }
  if (to) { where.push("day <= ?"); args.push(to.slice(0, 10)); }
  const views = await c.env.DB.prepare(
    `SELECT day, COUNT(*) AS views FROM page_views WHERE ${where.join(" AND ")} GROUP BY day ORDER BY day DESC`,
  )
    .bind(...args)
    .all<{ day: string; views: number }>();
  const leadDays = await c.env.DB.prepare(
    `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS leads FROM leads
     WHERE created_at IS NOT NULL GROUP BY 1`,
  ).all<{ day: string; leads: number }>();
  const clickDays = await c.env.DB.prepare(
    `SELECT substr(clicked_at, 1, 10) AS day, COUNT(*) AS clicks FROM telegram_clicks GROUP BY 1`,
  ).all<{ day: string; clicks: number }>();

  const leadMap = new Map(leadDays.results.map((r) => [r.day, r.leads]));
  const clickMap = new Map(clickDays.results.map((r) => [r.day, r.clicks]));
  const allDays = new Set<string>([
    ...views.results.map((r) => r.day),
    ...leadMap.keys(),
    ...clickMap.keys(),
  ]);
  const sorted = [...allDays].sort().reverse().slice(0, 400);

  const csv = toCsv(
    ["Day (UTC)", "Page views (captured)", "Registrations", "Telegram clicks"],
    sorted.map((d) => [d, views.results.find((v) => v.day === d)?.views ?? 0, leadMap.get(d) ?? 0, clickMap.get(d) ?? 0]),
  );
  await logExport(c as never, `Traffic CSV (${sorted.length} days)`);
  return csvResponse(fileName("cryptotoolshubb-traffic"), csv);
});

/** Audit log export + listing lives in reports for completeness. */
reportRoutes.get("/audit", async (c) => {
  const q = c.req.query() as Record<string, string | undefined>;
  const limit = Math.max(1, Math.min(200, Number(q.limit) || 50));
  const offset = Math.max(0, Number(q.offset) || 0);
  const total = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM audit_logs`).first<{ n: number }>();
  const rows = await c.env.DB.prepare(
    `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(limit, offset)
    .all();
  return c.json({ total: total?.n ?? 0, results: rows.results });
});

/* ---------------------------------- settings ---------------------------------- */

const SETTING_KEYS = ["telegram_username", "referral_name", "brand_name", "tagline", "contact_email", "disclaimer_version"];

reportRoutes.get("/settings", async (c) => {
  const rows = await c.env.DB.prepare(`SELECT key, value, updated_at FROM settings`).all<{
    key: string;
    value: string;
    updated_at: string;
  }>();
  const map: Record<string, string> = {};
  for (const r of rows.results) map[r.key] = r.value;
  const integrations = await c.env.DB.prepare(
    `SELECT key, value, updated_at FROM settings WHERE key LIKE 'integration:%'`,
  ).all<{ key: string; value: string; updated_at: string }>();
  return c.json({
    settings: map,
    integrations: integrations.results.map((r) => ({
      name: r.key.replace(/^integration:/, ""),
      raw: r.value,
      updated_at: r.updated_at,
    })),
    availableSettings: SETTING_KEYS,
  });
});

reportRoutes.put("/settings", async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body." }, 400);
  }
  const updates: Record<string, string> = {};
  for (const key of SETTING_KEYS) {
    if (body[key] !== undefined) {
      const v = optionalString(body[key], key, 300);
      if (v !== null) updates[key] = v;
    }
  }
  // Validate the Telegram handle: it must be a plain @name-safe handle.
  if (updates.telegram_username) {
    const handle = updates.telegram_username.replace(/^@/, "");
    if (!/^[A-Za-z0-9_]{4,32}$/.test(handle)) {
      return c.json({ error: "Telegram username must be 4–32 characters: letters, numbers, underscores." }, 400);
    }
    updates.telegram_username = handle;
  }
  if (!Object.keys(updates).length) return c.json({ error: "No valid settings provided." }, 400);

  const ts = nowIso();
  for (const [key, value] of Object.entries(updates)) {
    await c.env.DB.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
      .bind(key, value, ts)
      .run();
  }
  const admin = c.get("admin");
  await audit(c.env.DB, "settings.updated", "settings", null, `Updated: ${Object.keys(updates).join(", ")}`, admin.id, admin.email);
  const rows = await c.env.DB.prepare(`SELECT key, value, updated_at FROM settings`).all<{
    key: string;
    value: string;
    updated_at: string;
  }>();
  const map: Record<string, string> = {};
  for (const r of rows.results) map[r.key] = r.value;
  return c.json({ ok: true, settings: map });
});

/**
 * Record integration connection state. This stores what the admin declares —
 * it never claims a platform is connected; the UI shows "Not connected"
 * until an admin records verified credentials *and* marks it connected.
 */
reportRoutes.put("/integrations/:name", async (c) => {
  const name = cleanString(c.req.param("name"), "Integration", { min: 2, max: 40 }).toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(name)) return c.json({ error: "Invalid integration name." }, 400);
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body." }, 400);
  }
  const status = cleanString(body.status, "Status", { max: 30 });
  if (!["not_connected", "pending", "connected"].includes(status)) {
    return c.json({ error: "Status must be not_connected, pending or connected." }, 400);
  }
  const notes = optionalString(body.notes, "Notes", 1000);
  const payload = JSON.stringify({ status, notes, updated_by: c.get("admin").email });
  await c.env.DB.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  )
    .bind(`integration:${name}`, payload, nowIso())
    .run();
  const admin = c.get("admin");
  await audit(c.env.DB, "integration.updated", "integration", name, `Status → ${status}`, admin.id, admin.email);
  return c.json({ ok: true, name, status, notes });
});
