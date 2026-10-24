import { Hono } from "hono";
import type { Env } from "../lib/util";
import {
  badRequest,
  conflict,
  CONSENT_VERSION,
  HttpError,
  INTERESTS,
  CONTACT_METHODS,
  notFound,
  nowIso,
  todayUtc,
} from "../lib/util";
import { cleanEmail, cleanString, oneOf, optionalOneOf, optionalString, requireTrue } from "../lib/validate";

interface ConfigRow {
  key: string;
  value: string;
}

interface LeadRow {
  id: number;
  referral_id: string;
  first_name: string;
  unsubscribe_token: string;
  created_at: string;
}

/** Public, unauthenticated endpoints used by the marketing site. */
export const publicRoutes = new Hono<{ Bindings: Env }>();

function refId(n: number): string {
  return `CTH-${String(n).padStart(6, "0")}`;
}

/** Slugify source labels: "Facebook" -> "facebook", "QR code" -> "qr_code". */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/** Non-sensitive public config the browser needs (Telegram handle, brand). */
publicRoutes.get("/config", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT value FROM settings WHERE key IN ('telegram_username','referral_name','brand_name','tagline')`,
  ).all<ConfigRow>();
  const map = new Map(rows.results.map((r) => [r.key, r.value]));
  return c.json({
    brandName: map.get("brand_name") || "CryptoToolsHubb",
    tagline: map.get("tagline") || "Smarter Crypto Tools. Better-Informed Decisions.",
    telegramUsername: map.get("telegram_username") || "Azriel_xoxo",
    referralName: map.get("referral_name") || "Samjoe1234",
  });
});

/**
 * Lead registration: validates input, resolves campaign, allocates a unique
 * CTH-###### referral ID from an atomic counter, and returns confirmation data.
 */
publicRoutes.post("/leads", async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    throw badRequest("Invalid JSON body.");
  }

  const firstName = cleanString(body.firstName, "First name", { min: 2, max: 60 });
  const email = cleanEmail(body.email);
  const country = cleanString(body.country, "Country", { min: 2, max: 60 });
  const interest = oneOf(body.interest, INTERESTS, "Interest");
  const contactMethod = optionalOneOf(body.contactMethod, CONTACT_METHODS, "Contact method");
  const consent = requireTrue(body.consent, "Consent checkbox");
  const source = optionalString(body.source, "Source", 60);
  const medium = optionalString(body.medium, "Medium", 60);
  const campaign = optionalString(body.campaign, "Campaign", 80);
  const refCode = optionalString(body.refCode, "Ref code", 60);
  const landingPage = optionalString(body.landingPage, "Landing page", 300);
  const referrer = optionalString(body.referrer, "Referrer", 300);
  const utmContent = optionalString(body.utmContent, "UTM content", 80);

  if (country.length < 2) throw badRequest("Country is required.");
  const emailNorm = email;

  // Idempotent duplicate handling: same email keeps its original referral ID.
  const existing = (await c.env.DB.prepare(
    `SELECT id, referral_id, first_name, unsubscribe_token, created_at FROM leads WHERE email_normalized = ?`,
  )
    .bind(emailNorm)
    .first()) as LeadRow | null;
  if (existing) {
    return c.json(
      {
        ok: true,
        duplicate: true,
        referralId: existing.referral_id,
        firstName: existing.first_name,
        unsubscribeToken: existing.unsubscribe_token,
        registeredAt: existing.created_at,
        message: "You're already registered — here is your existing referral ID.",
      },
      200,
    );
  }

  // Resolve campaign: match on utm_source when present, else utm_campaign.
  let campaignId: number | null = null;
  if (source || campaign) {
    const match = (await c.env.DB.prepare(
      `SELECT id FROM campaigns
       WHERE is_active = 1
         AND (? IS NULL OR utm_source = ?)
         AND (? IS NULL OR utm_campaign = ?)
       ORDER BY (utm_source = ?) DESC, id DESC LIMIT 1`,
    )
      .bind(source, source, campaign, campaign, source ?? "")
      .first()) as { id: number } | null;
    campaignId = match?.id ?? null;
  }

  // Allocate a unique referral ID (atomic counter + unique-index backstop).
  const prefix = "CTH-";
  let attempts = 0;
  for (;;) {
    attempts++;
    if (attempts > 50) throw conflict("Could not allocate a unique referral ID. Please try again.");
    const seq = (await c.env.DB.prepare(
      `UPDATE counters SET value = value + 1 WHERE key = 'lead_seq' RETURNING value`,
    ).first<{ value: number }>())?.value;
    if (seq === undefined || seq === null) throw conflict("Referral counter unavailable. Please try again.");
    const referralId = refId(seq);
    try {
      const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const ts = nowIso();
      const inserted = await c.env.DB.prepare(
        `INSERT INTO leads
           (referral_id, first_name, email, email_normalized, country, interest, contact_method,
            consent_at, consent_version, status, source, medium, campaign, ref_code, landing_page,
            referrer, campaign_id, unsubscribe_token, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
      )
        .bind(
          referralId,
          firstName,
          email,
          emailNorm,
          country,
          interest,
          contactMethod,
          ts,
          CONSENT_VERSION,
          source ? slugify(source) : null,
          medium ? slugify(medium) : null,
          campaign,
          refCode,
          landingPage,
          referrer,
          campaignId,
          token,
          ts,
          ts,
        )
        .first<{ id: number }>();
      if (!inserted) throw conflict("Lead could not be saved.");

      // Record the acquisition event for campaign reporting.
      await c.env.DB.prepare(
        `INSERT INTO page_views (path, source, medium, campaign, ref_code, day, viewed_at)
         VALUES ('/register', ?, ?, ?, ?, ?, ?)`,
      ).bind(
        source ? slugify(source) : null,
        medium ? slugify(medium) : null,
        campaign,
        refCode,
        todayUtc(),
        ts,
      ).run();

      await audit(c.env.DB, "lead.registered", "lead", String(inserted.id), `Referral ${referralId}`);

      return c.json(
        {
          ok: true,
          duplicate: false,
          referralId,
          firstName,
          unsubscribeToken: token,
          registeredAt: ts,
          message: "Registration confirmed.",
        },
        201,
      );
    } catch (err) {
      // Unique referral_id collision -> allocate the next number and retry.
      const msg = err instanceof Error ? err.message : String(err);
      if (/UNIQUE constraint failed: leads\.referral_id/.test(msg)) continue;
      // Duplicate email raced in concurrently -> return the existing lead.
      if (/UNIQUE constraint failed: leads\.email_normalized/.test(msg)) {
        const row = (await c.env.DB.prepare(
          `SELECT referral_id, first_name, unsubscribe_token, created_at FROM leads WHERE email_normalized = ?`,
        )
          .bind(emailNorm)
          .first()) as LeadRow | null;
        if (row) {
          return c.json({
            ok: true,
            duplicate: true,
            referralId: row.referral_id,
            firstName: row.first_name,
            unsubscribeToken: row.unsubscribe_token,
            registeredAt: row.created_at,
            message: "You're already registered — here is your existing referral ID.",
          });
        }
      }
      throw err;
    }
  }
});

/**
 * Record a Telegram button click. Clicks are tracked as referral activity —
 * they are never treated as sales or proof a message was sent.
 */
publicRoutes.post("/telegram-click", async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    throw badRequest("Invalid JSON body.");
  }
  const referralId = cleanString(body.referralId, "Referral ID", { min: 4, max: 20 });
  if (!/^CTH-\d{6}$/.test(referralId)) throw badRequest("Referral ID format is invalid.");
  const source = optionalString(body.source, "Source", 60);
  const medium = optionalString(body.medium, "Medium", 60);
  const campaign = optionalString(body.campaign, "Campaign", 80);
  const landingPage = optionalString(body.landingPage, "Landing page", 300);

  const lead = (await c.env.DB.prepare(`SELECT id FROM leads WHERE referral_id = ?`)
    .bind(referralId)
    .first()) as { id: number } | null;
  if (!lead) throw notFound("Unknown referral ID.");

  const ts = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO telegram_clicks (lead_id, referral_id, clicked_at, source, medium, campaign, landing_page, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      lead.id,
      referralId,
      ts,
      source ? slugify(source) : null,
      medium ? slugify(medium) : null,
      campaign,
      landingPage,
      (c.req.header("user-agent") || "").slice(0, 200),
    )
    .run();

  return c.json({ ok: true, tracked: true, note: "Click recorded. A click is not proof of a sent message or a sale." });
});

/** Track a landing page view (first-party, cookie-free). */
publicRoutes.post("/view", async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    throw badRequest("Invalid JSON body.");
  }
  const path = cleanString(body.path, "Path", { min: 1, max: 300 });
  const source = optionalString(body.source, "Source", 60);
  const medium = optionalString(body.medium, "Medium", 60);
  const campaign = optionalString(body.campaign, "Campaign", 80);
  const refCode = optionalString(body.refCode, "Ref code", 60);
  if (!path.startsWith("/")) throw badRequest("Invalid path.");
  await c.env.DB.prepare(
    `INSERT INTO page_views (path, source, medium, campaign, ref_code, day, viewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(path, source ? slugify(source) : null, medium ? slugify(medium) : null, campaign, refCode, todayUtc(), nowIso())
    .run();
  return c.json({ ok: true });
});

/** Honor unsubscribe requests from email/footer links. */
publicRoutes.post("/unsubscribe", async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    throw badRequest("Invalid JSON body.");
  }
  const token = cleanString(body.token, "Token", { min: 10, max: 120 });
  const lead = (await c.env.DB.prepare(`SELECT id FROM leads WHERE unsubscribe_token = ?`)
    .bind(token)
    .first()) as { id: number } | null;
  if (!lead) throw notFound("Unsubscribe link is invalid or expired.");
  await c.env.DB.prepare(`UPDATE leads SET unsubscribed = 1, updated_at = ? WHERE id = ?`).bind(nowIso(), lead.id).run();
  await audit(c.env.DB, "lead.unsubscribed", "lead", String(lead.id), "Unsubscribe requested via public link");
  return c.json({ ok: true, message: "You have been unsubscribed from promotional messages." });
});


async function audit(
  db: D1Database,
  action: string,
  entity: string | null,
  entityId: string | null,
  detail: string | null,
  adminId: number | null = null,
  adminEmail: string | null = null,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_logs (admin_id, admin_email, action, entity, entity_id, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(adminId, adminEmail, action, entity, entityId, detail, nowIso())
    .run();
}

export { audit };
