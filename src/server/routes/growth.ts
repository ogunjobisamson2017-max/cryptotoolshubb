import { Hono } from "hono";
import type { Env } from "../lib/util";
import { badRequest, nowIso, PLATFORMS } from "../lib/util";
import { cleanString, optionalString, paging, oneOf, optionalIsoDate } from "../lib/validate";
import { audit } from "./public";

export const growthRoutes = new Hono<{
  Bindings: Env;
  Variables: { admin: { id: number; email: string; role: string } };
}>();

/* ---------------------------------- campaigns --------------------------------- */

growthRoutes.get("/campaigns", async (c) => {
  const q = c.req.query() as Record<string, string | undefined>;
  const { limit, offset } = paging(q);
  const total = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM campaigns`).first<{ n: number }>();
  const rows = await c.env.DB.prepare(
    `SELECT c.*,
            (SELECT COUNT(*) FROM leads l WHERE l.campaign_id = c.id) AS referrals,
            (SELECT COUNT(*) FROM telegram_clicks t WHERE t.campaign = c.utm_campaign) AS telegram_clicks,
            (SELECT COUNT(*) FROM sales s
               JOIN leads l2 ON l2.referral_id = s.referral_id
              WHERE l2.campaign_id = c.id AND s.payment_status IN ('Confirmed','Paid')) AS confirmed_conversions
     FROM campaigns c
     ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(limit, offset)
    .all();
  return c.json({ total: total?.n ?? 0, results: rows.results });
});

growthRoutes.post("/campaigns", async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    throw badRequest("Invalid JSON body.");
  }
  try {
    const name = cleanString(body.name, "Campaign name", { min: 2, max: 100 });
    const utmSource = cleanString(body.utmSource, "UTM source", { min: 2, max: 60 });
    const utmMedium = optionalString(body.utmMedium, "UTM medium", 60);
    const utmCampaign = optionalString(body.utmCampaign, "UTM campaign", 80) ?? slug(name);
    const utmContent = optionalString(body.utmContent, "UTM content", 80);
    const utmTerm = optionalString(body.utmTerm, "UTM term", 80);
    const landingPath = optionalString(body.landingPath, "Landing path", 200) ?? "/get-started";
    const notes = optionalString(body.notes, "Notes", 1000);
    if (!landingPath.startsWith("/")) throw badRequest("Landing path must start with /.");

    const ts = nowIso();
    const row = await c.env.DB.prepare(
      `INSERT INTO campaigns (name, utm_source, utm_medium, utm_campaign, utm_content, utm_term, landing_path, notes, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?) RETURNING *`,
    )
      .bind(name, utmSource, utmMedium, utmCampaign, utmContent, utmTerm, landingPath, notes, ts, ts)
      .first();

    const admin = c.get("admin");
    await audit(c.env.DB, "campaign.created", "campaign", String((row as { id: number }).id), name, admin.id, admin.email);
    return c.json({ ok: true, campaign: row }, 201);
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) {
      const e = err as { status: number; message: string };
      return c.json({ error: e.message }, e.status as 400);
    }
    throw err;
  }
});

growthRoutes.patch("/campaigns/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "Invalid campaign id." }, 400);
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body." }, 400);
  }
  const existing = await c.env.DB.prepare(`SELECT * FROM campaigns WHERE id = ?`).bind(id).first();
  if (!existing) return c.json({ error: "Campaign not found." }, 404);

  const updates: string[] = [];
  const args: unknown[] = [];
  if (body.name !== undefined) { updates.push("name = ?"); args.push(cleanString(body.name, "Name", { min: 2, max: 100 })); }
  if (body.utmSource !== undefined) { updates.push("utm_source = ?"); args.push(cleanString(body.utmSource, "UTM source", { min: 2, max: 60 })); }
  if (body.utmMedium !== undefined) { updates.push("utm_medium = ?"); args.push(optionalString(body.utmMedium, "UTM medium", 60)); }
  if (body.utmCampaign !== undefined) { updates.push("utm_campaign = ?"); args.push(optionalString(body.utmCampaign, "UTM campaign", 80)); }
  if (body.notes !== undefined) { updates.push("notes = ?"); args.push(optionalString(body.notes, "Notes", 1000)); }
  if (body.isActive !== undefined) { updates.push("is_active = ?"); args.push(body.isActive ? 1 : 0); }
  if (!updates.length) return c.json({ error: "Nothing to update." }, 400);
  updates.push("updated_at = ?");
  args.push(nowIso(), id);
  await c.env.DB.prepare(`UPDATE campaigns SET ${updates.join(", ")} WHERE id = ?`).bind(...args).run();

  const admin = c.get("admin");
  await audit(c.env.DB, "campaign.updated", "campaign", String(id), "Campaign updated", admin.id, admin.email);
  return c.json({ ok: true, campaign: await c.env.DB.prepare(`SELECT * FROM campaigns WHERE id = ?`).bind(id).first() });
});

growthRoutes.delete("/campaigns/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "Invalid campaign id." }, 400);
  await c.env.DB.prepare(`DELETE FROM campaigns WHERE id = ?`).bind(id).run();
  const admin = c.get("admin");
  await audit(c.env.DB, "campaign.deleted", "campaign", String(id), "Campaign deleted", admin.id, admin.email);
  return c.json({ ok: true });
});

/* ----------------------------------- content ---------------------------------- */

growthRoutes.get("/content", async (c) => {
  const q = c.req.query() as Record<string, string | undefined>;
  const { limit, offset } = paging(q);
  const status = q.status && q.status !== "all" ? cleanString(q.status, "Status", { max: 20 }) : null;
  const platform = q.platform && q.platform !== "all" ? cleanString(q.platform, "Platform", { max: 30 }) : null;

  const where: string[] = ["1=1"];
  const args: unknown[] = [];
  if (status) { where.push("status = ?"); args.push(status); }
  if (platform) { where.push("platform = ?"); args.push(platform); }
  const total = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM content_drafts WHERE ${where.join(" AND ")}`)
    .bind(...args)
    .first<{ n: number }>();
  const rows = await c.env.DB.prepare(
    `SELECT * FROM content_drafts WHERE ${where.join(" AND ")}
     ORDER BY COALESCE(scheduled_at, created_at) DESC, id DESC LIMIT ? OFFSET ?`,
  )
    .bind(...args, limit, offset)
    .all();
  return c.json({ total: total?.n ?? 0, results: rows.results });
});

/**
 * Generate content drafts from a curated educational topic bank.
 * Everything generated is educational material — no performance claims.
 */
growthRoutes.post("/content/generate", async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    throw badRequest("Invalid JSON body.");
  }
  const topic = cleanString(body.topic, "Topic", { min: 2, max: 120 });
  const platform = oneOf(body.platform, PLATFORMS, "Platform");
  const count = Math.max(1, Math.min(6, Number(body.count) || 3));

  const templates = PLATFORM_TEMPLATES[platform] ?? PLATFORM_TEMPLATES.Blog;
  const generated = [];
  for (let i = 0; i < count; i++) {
    const tpl = templates[i % templates.length];
    generated.push({
      title: tpl.title(topic),
      body: tpl.body(topic) + COMMON_TAIL,
      platform,
      content_type: "Educational",
      hashtags: tpl.hashtags ?? null,
      status: "Draft" as const,
    });
  }
  return c.json({ ok: true, generated, note: "Drafts are generated from educational templates. Review before publishing." });
});

growthRoutes.post("/content", async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    throw badRequest("Invalid JSON body.");
  }
  try {
    const title = cleanString(body.title, "Title", { min: 2, max: 160 });
    const content = cleanString(body.body, "Content", { min: 2, max: 5000 });
    const platform = oneOf(body.platform, PLATFORMS, "Platform");
    const contentType = optionalString(body.contentType, "Content type", 40) ?? "Educational";
    const hashtags = optionalString(body.hashtags, "Hashtags", 500);
    const status = body.status ? oneOf(body.status, ["Draft", "Scheduled"] as const, "Status") : "Draft";
    const scheduledAt = status === "Scheduled" ? optionalIsoDate(body.scheduledAt, "Scheduled at") : null;
    if (status === "Scheduled" && !scheduledAt) throw badRequest("Scheduled content needs a scheduled date/time.");

    const ts = nowIso();
    const admin = c.get("admin");
    const row = await c.env.DB.prepare(
      `INSERT INTO content_drafts (title, body, platform, content_type, status, hashtags, scheduled_at, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    )
      .bind(title, content, platform, contentType, status, hashtags, scheduledAt, ts, ts, admin.id)
      .first();
    await audit(c.env.DB, "content.created", "content", String((row as { id: number }).id), `${platform}: ${title}`, admin.id, admin.email);
    return c.json({ ok: true, content: row }, 201);
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) {
      const e = err as { status: number; message: string };
      return c.json({ error: e.message }, e.status as 400);
    }
    throw err;
  }
});

/** Status transitions: Draft/Scheduled/Published/Failed (no fake publishing). */
growthRoutes.patch("/content/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "Invalid id." }, 400);
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body." }, 400);
  }
  const existing = await c.env.DB.prepare(`SELECT * FROM content_drafts WHERE id = ?`).bind(id).first<
    Record<string, unknown>
  >();
  if (!existing) return c.json({ error: "Content not found." }, 404);

  const updates: string[] = [];
  const args: unknown[] = [];
  if (body.title !== undefined) { updates.push("title = ?"); args.push(cleanString(body.title, "Title", { min: 2, max: 160 })); }
  if (body.body !== undefined) { updates.push("body = ?"); args.push(cleanString(body.body, "Content", { min: 2, max: 5000 })); }
  if (body.hashtags !== undefined) { updates.push("hashtags = ?"); args.push(optionalString(body.hashtags, "Hashtags", 500)); }
  if (body.campaignId !== undefined) {
    updates.push("campaign_id = ?");
    args.push(body.campaignId === null ? null : Number(body.campaignId) || null);
  }

  if (body.status !== undefined) {
    const next = oneOf(body.status, ["Draft", "Scheduled", "Published", "Failed"] as const, "Status");
    if (next === "Scheduled") {
      const when = optionalIsoDate(body.scheduledAt, "Scheduled at");
      if (!when) return c.json({ error: "Scheduling requires a scheduled date/time." }, 400);
      updates.push("scheduled_at = ?");
      args.push(when);
    }
    if (next === "Published") {
      const publishedAt = optionalIsoDate(body.publishedAt, "Published at") ?? nowIso();
      updates.push("published_at = ?");
      args.push(publishedAt);
      const url = optionalString(body.publishUrl, "Post URL", 500);
      if (url && !/^https?:\/\//i.test(url)) return c.json({ error: "Post URL must start with http:// or https://" }, 400);
      updates.push("publish_url = ?");
      args.push(url);
    }
    if (next === "Failed") {
      const reason = optionalString(body.failureReason, "Failure reason", 500);
      if (!reason) return c.json({ error: "Marking content Failed requires a reason." }, 400);
      updates.push("failure_reason = ?");
      args.push(reason);
    }
    updates.push("status = ?");
    args.push(next);
  }
  if (!updates.length) return c.json({ error: "Nothing to update." }, 400);
  updates.push("updated_at = ?");
  args.push(nowIso(), id);
  await c.env.DB.prepare(`UPDATE content_drafts SET ${updates.join(", ")} WHERE id = ?`).bind(...args).run();

  const admin = c.get("admin");
  await audit(c.env.DB, "content.updated", "content", String(id), `Status → ${body.status ?? "edited"}`, admin.id, admin.email);
  return c.json({ ok: true, content: await c.env.DB.prepare(`SELECT * FROM content_drafts WHERE id = ?`).bind(id).first() });
});

growthRoutes.delete("/content/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "Invalid id." }, 400);
  await c.env.DB.prepare(`DELETE FROM content_drafts WHERE id = ?`).bind(id).run();
  const admin = c.get("admin");
  await audit(c.env.DB, "content.deleted", "content", String(id), "Deleted", admin.id, admin.email);
  return c.json({ ok: true });
});

/* ---------------------------------- helpers ----------------------------------- */

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
}

interface Template {
  title: (t: string) => string;
  body: (t: string) => string;
  hashtags?: string;
}

const COMMON_TAIL =
  "\n\nEducational content only — not financial advice. Crypto assets are volatile and you can lose money. CryptoToolsHubb does not promise returns or profits.";

const PLATFORM_TEMPLATES: Record<string, Template[]> = {
  X: [
    {
      title: (t) => `${t} — a quick primer`,
      body: (t) =>
        `🧵 What to know about ${t} before you act:\n\n1. Understand what you're actually buying or using.\n2. Compare tools on data, not hype.\n3. Size positions you can afford to lose.\n\nSave this for later. More breakdowns below.`,
      hashtags: "#crypto #tradingtools #cryptoresearch",
    },
    {
      title: (t) => `3 questions to ask about ${t}`,
      body: (t) =>
        `Before using any approach tied to ${t}, ask:\n\n• What evidence backs it?\n• What's the worst-case downside?\n• Who profits when I trade?\n\nNo hype. Just better-informed decisions.`,
      hashtags: "#crypto #duediligence #riskmanagement",
    },
  ],
  Instagram: [
    {
      title: (t) => `${t}: what it is and why it matters`,
      body: (t) =>
        `📌 ${t}\n\nWe break it down in plain English: what it is, how people use it, and the risks most posts skip.\n\nSwipe-through points:\n→ Definition without jargon\n→ Common mistakes\n→ How to evaluate it yourself\n\nEducational only. Always do your own research.`,
      hashtags: "#cryptoeducation #cryptotools #blockchain #tradingrisk #crypto101",
    },
  ],
  Facebook: [
    {
      title: (t) => `Understanding ${t} (plain-English guide)`,
      body: (t) =>
        `A short, plain-English guide to ${t}.\n\nWe cover: what it means, how it's commonly used, and the risks to weigh before acting. No promises, no hype — just the information you need to make your own call.\n\nRead the full explainer on our site.`,
      hashtags: "",
    },
  ],
  Telegram: [
    {
      title: (t) => `Channel note: ${t}`,
      body: (t) =>
        `📢 Today's topic: ${t}\n\nKey takeaways:\n• Understand the tool before you rely on it.\n• Signals are inputs, not guarantees.\n• Never risk money you can't afford to lose.\n\nQuestions? Reply in the channel.`,
      hashtags: "",
    },
  ],
  LinkedIn: [
    {
      title: (t) => `A framework for evaluating ${t}`,
      body: (t) =>
        `Most discussions of ${t} skip the evaluation step.\n\nA simple framework:\n1. Source — where does the data come from?\n2. Incentive — who benefits from your action?\n3. Downside — what does failure look like?\n4. Evidence — what's verifiable vs. claimed?\n\nStructured evaluation beats enthusiasm every time.`,
      hashtags: "#crypto #research #risk",
    },
  ],
  Blog: [
    {
      title: (t) => `${t}: A Practical Introduction`,
      body: (t) =>
        `## Why ${t} matters\n\nA concise, educational overview of ${t}, written for readers who want understanding before action.\n\n## What we cover\n- Definitions and core concepts\n- Common use cases and misconceptions\n- Risks and how to evaluate them yourself\n- Questions to ask before using any related tool\n\n## The bottom line\nApproach every crypto tool with healthy skepticism. Nothing here is financial advice, and outcomes are never guaranteed.`,
      hashtags: "",
    },
  ],
  Email: [
    {
      title: (t) => `This week: ${t}`,
      body: (t) =>
        `Hi there,\n\nThis week's educational note covers ${t} — what it means, how people use it, and the risks worth weighing first.\n\nYou're receiving this because you asked to hear from CryptoToolsHubb. Click unsubscribe any time; we won't contact you after you opt out.\n\n— The CryptoToolsHubb team`,
      hashtags: "",
    },
  ],
};
