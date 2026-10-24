import { Hono } from "hono";
import type { Env } from "../lib/util";
import { CONFIRMED_SALE_STATUSES, LEAD_STATUSES, nowIso, todayUtc } from "../lib/util";
import { dateRange, oneOf, optionalString, paging, cleanString } from "../lib/validate";

export const adminDataRoutes = new Hono<{ Bindings: Env; Variables: { admin: { id: number; email: string; role: string } } }>();

/** Overview metrics. All figures come from recorded events only. */
adminDataRoutes.get("/overview", async (c) => {
  const db = c.env.DB;
  const { from, to } = dateRange(c.req.query() as Record<string, string | undefined>);
  const rangeClause = from && to ? `AND created_at >= ? AND created_at <= ?` : "";
  const rangeArgs = from && to ? [from, to] : [];

  const leadsTotal = await db.prepare(`SELECT COUNT(*) AS n FROM leads`).first<{ n: number }>();
  const leadsToday = await db
    .prepare(`SELECT COUNT(*) AS n FROM leads WHERE created_at >= ?`)
    .bind(`${todayUtc()}T00:00:00.000Z`)
    .first<{ n: number }>();
  const leadsInRange = from && to
    ? (await db.prepare(`SELECT COUNT(*) AS n FROM leads WHERE created_at >= ? AND created_at <= ?`).bind(...rangeArgs).first<{ n: number }>())
    : leadsTotal;

  const clicksTotal = await db.prepare(`SELECT COUNT(*) AS n FROM telegram_clicks`).first<{ n: number }>();
  const clicksToday = await db
    .prepare(`SELECT COUNT(*) AS n FROM telegram_clicks WHERE clicked_at >= ?`)
    .bind(`${todayUtc()}T00:00:00.000Z`)
    .first<{ n: number }>();

  const salesRows = await db
    .prepare(
      `SELECT
         COUNT(*) AS confirmed_sales,
         COUNT(DISTINCT referral_id) AS confirmed_customers,
         COALESCE(SUM(commission_usd), 0) AS total_commission
       FROM sales WHERE payment_status IN ('Confirmed', 'Paid')`,
    )
    .first<{ confirmed_sales: number; confirmed_customers: number; total_commission: number }>();

  const pendingSales = await db
    .prepare(`SELECT COUNT(*) AS n FROM sales WHERE payment_status = 'Pending'`)
    .first<{ n: number }>();

  const viewsTotal = await db.prepare(`SELECT COUNT(*) AS n FROM page_views`).first<{ n: number }>();
  const viewsInRange = from && to
    ? (await db.prepare(`SELECT COUNT(*) AS n FROM page_views WHERE viewed_at >= ? AND viewed_at <= ?`).bind(...rangeArgs).first<{ n: number }>())
    : viewsTotal;

  // Traffic sources (by captured first-party attribution on leads)
  const sourceRows = await db
    .prepare(
      `SELECT COALESCE(source, 'direct_or_unknown') AS source, COUNT(*) AS leads
       FROM leads GROUP BY 1 ORDER BY leads DESC LIMIT 12`,
    )
    .all<{ source: string; leads: number }>();
  const clickSourceRows = await db
    .prepare(
      `SELECT COALESCE(source, 'direct_or_unknown') AS source, COUNT(*) AS clicks
       FROM telegram_clicks GROUP BY 1 ORDER BY clicks DESC LIMIT 12`,
    )
    .all<{ source: string; clicks: number }>();
  const clickBySource = new Map(clickSourceRows.results.map((r) => [r.source, r.clicks]));

  const statusRows = await db
    .prepare(`SELECT status, COUNT(*) AS n FROM leads GROUP BY status`)
    .all<{ status: string; n: number }>();

  const totalLeads = leadsTotal?.n ?? 0;
  const customers = salesRows?.confirmed_customers ?? 0;
  const conversionRate = totalLeads > 0 ? Math.round((customers / totalLeads) * 10000) / 100 : 0;

  const recentLeads = await db
    .prepare(
      `SELECT referral_id, first_name, interest, status, source, created_at
       FROM leads ORDER BY created_at DESC LIMIT 8`,
    )
    .all();

  const recentSales = await db
    .prepare(
      `SELECT referral_id, customer_label, product_name, sale_amount_usd, commission_usd, payment_status, sale_date
       FROM sales ORDER BY created_at DESC LIMIT 8`,
    )
    .all();

  const scheduled = await db
    .prepare(`SELECT COUNT(*) AS n FROM content_drafts WHERE status IN ('Scheduled', 'Draft')`)
    .first<{ n: number }>();

  return c.json({
    range: { from, to },
    totals: {
      totalLeads,
      leadsToday: leadsToday?.n ?? 0,
      leadsInRange: leadsInRange?.n ?? 0,
      telegramClicks: clicksTotal?.n ?? 0,
      telegramClicksToday: clicksToday?.n ?? 0,
      confirmedCustomers: customers,
      confirmedSales: salesRows?.confirmed_sales ?? 0,
      totalConfirmedCommission: salesRows?.total_commission ?? 0,
      pendingSales: pendingSales?.n ?? 0,
      conversionRate,
      pageViews: viewsTotal?.n ?? 0,
      pageViewsInRange: viewsInRange?.n ?? 0,
      contentInQueue: scheduled?.n ?? 0,
    },
    trafficSources: sourceRows.results.map((r) => ({
      source: r.source,
      leads: r.leads,
      telegramClicks: clickBySource.get(r.source) ?? 0,
    })),
    statusBreakdown: statusRows.results,
    recentLeads: recentLeads.results,
    recentSales: recentSales.results,
    disclaimer:
      "Figures count events captured by this system only. Telegram clicks are not sales, and no values are projected or estimated.",
  });
});

/** Leads list with search + filters. */
adminDataRoutes.get("/leads", async (c) => {
  const q = c.req.query() as Record<string, string | undefined>;
  const { limit, offset, page } = paging(q);
  const search = (q.search || "").trim().slice(0, 120);
  const status = q.status && q.status !== "all" ? oneOf(q.status, LEAD_STATUSES, "Status") : null;
  const interest = q.interest && q.interest !== "all" ? cleanString(q.interest, "Interest", { max: 40 }) : null;
  const source = q.source && q.source !== "all" ? cleanString(q.source, "Source", { max: 60 }) : null;
  const { from, to } = dateRange(q);
  const unsubscribed = q.unsubscribed === "true" ? true : q.unsubscribed === "false" ? false : null;

  const where: string[] = ["1=1"];
  const args: unknown[] = [];
  if (search) {
    where.push(`(first_name LIKE ? OR email LIKE ? OR referral_id LIKE ?)`);
    const like = `%${search}%`;
    args.push(like, like, like);
  }
  if (status) { where.push(`status = ?`); args.push(status); }
  if (interest) { where.push(`interest = ?`); args.push(interest); }
  if (source) { where.push(`source = ?`); args.push(source); }
  if (unsubscribed !== null) { where.push(`unsubscribed = ?`); args.push(unsubscribed ? 1 : 0); }
  if (from) { where.push(`created_at >= ?`); args.push(from); }
  if (to) { where.push(`created_at <= ?`); args.push(to); }
  const whereSql = where.join(" AND ");

  const total = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM leads WHERE ${whereSql}`)
    .bind(...args)
    .first<{ n: number }>();

  const rows = await c.env.DB.prepare(
    `SELECT l.id, l.referral_id, l.first_name, l.email, l.country, l.interest, l.contact_method,
            l.status, l.notes, l.source, l.medium, l.campaign, l.ref_code, l.created_at, l.unsubscribed,
            (SELECT COUNT(*) FROM telegram_clicks t WHERE t.referral_id = l.referral_id) AS telegram_clicks,
            (SELECT COUNT(*) FROM sales s WHERE s.referral_id = l.referral_id AND s.payment_status IN ('Confirmed','Paid')) AS confirmed_sales
     FROM leads l
     WHERE ${whereSql}
     ORDER BY l.created_at DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(...args, limit, offset)
    .all();

  return c.json({
    total: total?.n ?? 0,
    page,
    limit,
    results: rows.results,
  });
});

/** Update lead status / notes. */
adminDataRoutes.patch("/leads/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "Invalid lead id." }, 400);
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body." }, 400);
  }

  const existing = await c.env.DB.prepare(`SELECT id, status, notes FROM leads WHERE id = ?`).bind(id).first<{
    id: number;
    status: string;
    notes: string | null;
  }>();
  if (!existing) return c.json({ error: "Lead not found." }, 404);

  const updates: string[] = [];
  const args: unknown[] = [];
  if (body.status !== undefined) {
    const status = oneOf(body.status, LEAD_STATUSES, "Status");
    updates.push(`status = ?`);
    args.push(status);
  }
  if (body.notes !== undefined) {
    const notes = optionalString(body.notes, "Notes", 2000);
    updates.push(`notes = ?`);
    args.push(notes);
  }
  if (!updates.length) return c.json({ error: "Nothing to update." }, 400);
  updates.push(`updated_at = ?`);
  args.push(nowIso(), id);

  await c.env.DB.prepare(`UPDATE leads SET ${updates.join(", ")} WHERE id = ?`).bind(...args).run();

  const admin = c.get("admin");
  await c.env.DB.prepare(
    `INSERT INTO audit_logs (admin_id, admin_email, action, entity, entity_id, detail, created_at)
     VALUES (?, ?, 'lead.updated', 'lead', ?, ?, ?)`,
  )
    .bind(admin.id, admin.email, String(id), `Status: ${existing.status} → ${body.status ?? existing.status}`, nowIso())
    .run();

  const fresh = await c.env.DB.prepare(
    `SELECT id, referral_id, first_name, email, country, interest, contact_method, status, notes,
            source, medium, campaign, ref_code, created_at, unsubscribed
     FROM leads WHERE id = ?`,
  )
    .bind(id)
    .first();
  return c.json({ ok: true, lead: fresh });
});

/** Sales list. */
adminDataRoutes.get("/sales", async (c) => {
  const q = c.req.query() as Record<string, string | undefined>;
  const { limit, offset, page } = paging(q);
  const search = (q.search || "").trim().slice(0, 120);
  const status = q.status && q.status !== "all" ? cleanString(q.status, "Status", { max: 20 }) : null;
  const { from, to } = dateRange(q);

  const where: string[] = ["1=1"];
  const args: unknown[] = [];
  if (search) {
    where.push(`(referral_id LIKE ? OR customer_label LIKE ? OR product_name LIKE ?)`);
    const like = `%${search}%`;
    args.push(like, like, like);
  }
  if (status) { where.push(`payment_status = ?`); args.push(status); }
  if (from) { where.push(`sale_date >= ?`); args.push(from); }
  if (to) { where.push(`sale_date <= ?`); args.push(to); }
  const whereSql = where.join(" AND ");

  const total = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM sales WHERE ${whereSql}`)
    .bind(...args)
    .first<{ n: number }>();
  const rows = await c.env.DB.prepare(
    `SELECT * FROM sales WHERE ${whereSql} ORDER BY sale_date DESC, id DESC LIMIT ? OFFSET ?`,
  )
    .bind(...args, limit, offset)
    .all();

  const sums = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(sale_amount_usd),0) AS revenue, COALESCE(SUM(commission_usd),0) AS commission
     FROM sales WHERE ${whereSql} AND payment_status IN ('Confirmed','Paid')`,
  )
    .bind(...args)
    .first<{ revenue: number; commission: number }>();

  return c.json({
    total: total?.n ?? 0,
    page,
    limit,
    results: rows.results,
    confirmedTotals: { revenue: sums?.revenue ?? 0, commission: sums?.commission ?? 0 },
  });
});

/** Create a sale/commission record. */
adminDataRoutes.post("/sales", async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body." }, 400);
  }
  try {
    const referralId = cleanString(body.referralId, "Referral ID", { min: 3, max: 24 });
    const customerLabel = cleanString(body.customerLabel, "Customer", { min: 2, max: 120 });
    const productName = cleanString(body.productName, "Product", { min: 2, max: 120 });
    const saleDate = cleanString(body.saleDate, "Sale date", { max: 40 });
    if (Number.isNaN(Date.parse(saleDate))) return c.json({ error: "Sale date is invalid." }, 400);
    const saleAmount = Number(body.saleAmountUsd);
    const commission = Number(body.commissionUsd);
    if (!Number.isFinite(saleAmount) || saleAmount < 0) return c.json({ error: "Sale amount must be 0 or more." }, 400);
    if (!Number.isFinite(commission) || commission < 0) return c.json({ error: "Commission must be 0 or more." }, 400);
    const paymentStatus = cleanString(body.paymentStatus, "Payment status", { max: 20 });
    if (!["Pending", "Confirmed", "Paid", "Rejected"].includes(paymentStatus)) {
      return c.json({ error: "Payment status must be Pending, Confirmed, Paid or Rejected." }, 400);
    }
    const confirmationSource = optionalString(body.confirmationSource, "Confirmation source", 120);
    const notes = optionalString(body.notes, "Notes", 2000);

    if (["Confirmed", "Paid"].includes(paymentStatus) && !confirmationSource) {
      return c.json({ error: "Confirmed/Paid sales require a confirmation source (how the sale was verified)." }, 400);
    }

    const lead = await c.env.DB.prepare(`SELECT id FROM leads WHERE referral_id = ?`).bind(referralId).first<{
      id: number;
    }>();

    const admin = c.get("admin");
    const ts = nowIso();
    const sale = await c.env.DB.prepare(
      `INSERT INTO sales (referral_id, lead_id, customer_label, product_name, sale_date, sale_amount_usd,
                          commission_usd, payment_status, confirmation_source, notes, confirmed_at,
                          created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    )
      .bind(
        referralId,
        lead?.id ?? null,
        customerLabel,
        productName,
        new Date(saleDate).toISOString().slice(0, 10),
        saleAmount,
        commission,
        paymentStatus,
        confirmationSource,
        notes,
        ["Confirmed", "Paid"].includes(paymentStatus) ? ts : null,
        ts,
        ts,
        admin.id,
      )
      .first();

    // Promote the linked lead when a sale is verified.
    if (lead && ["Confirmed", "Paid"].includes(paymentStatus)) {
      await c.env.DB.prepare(`UPDATE leads SET status = 'Converted', updated_at = ? WHERE id = ? AND status NOT IN ('Converted')`)
        .bind(ts, lead.id)
        .run();
    }

    await c.env.DB.prepare(
      `INSERT INTO audit_logs (admin_id, admin_email, action, entity, entity_id, detail, created_at)
       VALUES (?, ?, 'sale.created', 'sale', ?, ?, ?)`,
    )
      .bind(admin.id, admin.email, String((sale as { id: number }).id), `${referralId} · ${productName} · ${paymentStatus}`, ts)
      .run();

    return c.json({ ok: true, sale }, 201);
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) {
      const e = err as { status: number; message: string };
      return c.json({ error: e.message }, e.status as 400);
    }
    throw err;
  }
});

/** Update a sale. Changing to Confirmed/Paid requires a confirmation source. */
adminDataRoutes.patch("/sales/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "Invalid sale id." }, 400);
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body." }, 400);
  }
  const existing = await c.env.DB.prepare(`SELECT * FROM sales WHERE id = ?`).bind(id).first<
    Record<string, unknown>
  >();
  if (!existing) return c.json({ error: "Sale not found." }, 404);

  const updates: string[] = [];
  const args: unknown[] = [];
  const logParts: string[] = [];

  if (body.paymentStatus !== undefined) {
    const s = cleanString(body.paymentStatus, "Payment status", { max: 20 });
    if (!["Pending", "Confirmed", "Paid", "Rejected"].includes(s)) {
      return c.json({ error: "Invalid payment status." }, 400);
    }
    const confirming = ["Confirmed", "Paid"].includes(s);
    const source = typeof body.confirmationSource === "string" ? body.confirmationSource.trim() : String(existing.confirmation_source || "");
    if (confirming && !source) {
      return c.json({ error: "Marking a sale Confirmed/Paid requires a confirmation source (how it was verified)." }, 400);
    }
    updates.push(`payment_status = ?`);
    args.push(s);
    logParts.push(`status ${existing.payment_status} → ${s}`);
    if (confirming) {
      updates.push(`confirmed_at = ?`);
      args.push(nowIso());
    }
  }
  if (body.confirmationSource !== undefined) {
    const v = optionalString(body.confirmationSource, "Confirmation source", 120);
    updates.push(`confirmation_source = ?`);
    args.push(v);
  }
  if (body.notes !== undefined) {
    updates.push(`notes = ?`);
    args.push(optionalString(body.notes, "Notes", 2000));
  }
  if (body.commissionUsd !== undefined) {
    const n = Number(body.commissionUsd);
    if (!Number.isFinite(n) || n < 0) return c.json({ error: "Commission must be 0 or more." }, 400);
    updates.push(`commission_usd = ?`);
    args.push(n);
    logParts.push(`commission → ${n}`);
  }
  if (body.saleAmountUsd !== undefined) {
    const n = Number(body.saleAmountUsd);
    if (!Number.isFinite(n) || n < 0) return c.json({ error: "Sale amount must be 0 or more." }, 400);
    updates.push(`sale_amount_usd = ?`);
    args.push(n);
  }
  if (body.productName !== undefined) {
    updates.push(`product_name = ?`);
    args.push(cleanString(body.productName, "Product", { min: 2, max: 120 }));
  }
  if (body.customerLabel !== undefined) {
    updates.push(`customer_label = ?`);
    args.push(cleanString(body.customerLabel, "Customer", { min: 2, max: 120 }));
  }
  if (!updates.length) return c.json({ error: "Nothing to update." }, 400);

  updates.push(`updated_at = ?`);
  args.push(nowIso(), id);
  await c.env.DB.prepare(`UPDATE sales SET ${updates.join(", ")} WHERE id = ?`).bind(...args).run();

  // Keep lead status consistent with verified sales.
  if (body.paymentStatus !== undefined && ["Confirmed", "Paid"].includes(String(body.paymentStatus))) {
    if (existing.lead_id) {
      await c.env.DB.prepare(
        `UPDATE leads SET status = 'Converted', updated_at = ? WHERE id = ? AND status != 'Converted'`,
      )
        .bind(nowIso(), existing.lead_id)
        .run();
    }
  }

  const admin = c.get("admin");
  await c.env.DB.prepare(
    `INSERT INTO audit_logs (admin_id, admin_email, action, entity, entity_id, detail, created_at)
     VALUES (?, ?, 'sale.updated', 'sale', ?, ?, ?)`,
  )
    .bind(admin.id, admin.email, String(id), logParts.join("; ") || "Updated", nowIso())
    .run();

  const fresh = await c.env.DB.prepare(`SELECT * FROM sales WHERE id = ?`).bind(id).first();
  return c.json({ ok: true, sale: fresh });
});

/** Delete a sale (admin, audited). */
adminDataRoutes.delete("/sales/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "Invalid sale id." }, 400);
  const existing = await c.env.DB.prepare(`SELECT id, referral_id FROM sales WHERE id = ?`).bind(id).first<{
    id: number;
    referral_id: string;
  }>();
  if (!existing) return c.json({ error: "Sale not found." }, 404);
  await c.env.DB.prepare(`DELETE FROM sales WHERE id = ?`).bind(id).run();
  const admin = c.get("admin");
  await c.env.DB.prepare(
    `INSERT INTO audit_logs (admin_id, admin_email, action, entity, entity_id, detail, created_at)
     VALUES (?, ?, 'sale.deleted', 'sale', ?, ?, ?)`,
  )
    .bind(admin.id, admin.email, String(id), `Deleted sale for ${existing.referral_id}`, nowIso())
    .run();
  return c.json({ ok: true });
});
