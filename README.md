# CryptoToolsHubb

**Smarter Crypto Tools. Better-Informed Decisions.**

A complete crypto affiliate lead-generation website + administrative dashboard:

- **Public site** — Homepage, Crypto Tools, Crypto Research (education library), Get Started (lead capture),
  Privacy, Terms, Risk Disclaimer, Contact, Unsubscribe.
- **Backend** — Cloudflare Worker (Hono) with a persistent **D1 (SQLite) database**, server-side validation,
  PBKDF2-hashed admin passwords, DB-backed sessions, CSRF origin checks, audit logging.
- **Referral system** — every lead gets a unique `CTH-######` ID (atomic counter + unique-index backstop),
  Telegram contact button with a prefilled message to **@Azriel_xoxo** (referral name **Samjoe1234**),
  and click events tracked *separately from sales*.
- **Admin dashboard** (`/admin`) — Overview metrics, Lead management, Sales & Commission tracking
  (confirmation source required before Confirmed/Paid), Growth Center (content drafts, weekly calendar,
  campaigns + UTM links, platform connection status), Reports with **CSV exports**, Settings.

## Quick start

```bash
npm install                      # (already done in this workspace)
npm run build                    # builds the React client into dist/client
npm run db:migrate:local         # applies migrations to local D1
npm run dev                      # wrangler dev on http://0.0.0.0:3000
npm run typecheck                # tsc for server + client
npm run smoke                    # 112-assertion HTTP acceptance suite (server must be running)
```

Local secrets live in `.dev.vars` (git-ignored). That file is used **only by the local dev server** (`wrangler dev`). It is **never** deployed to production.

```
ADMIN_SETUP_TOKEN=local-dev-setup-token-change-me
APP_ENV=local
```

For production you set production secrets with `wrangler secret put` (or your hosting dashboard) — pair the production `ADMIN_SETUP_TOKEN` with `APP_ENV=production` and `APP_ORIGIN` (if using a custom domain). The dev token cannot reach production because it is not set as a production secret, and setup requires the exact configured secret.

## First-time admin setup

1. Visit **`/admin/setup`**.
2. Enter the `ADMIN_SETUP_TOKEN` value, your email, and a password (12+ chars, letter + number).
3. The account can only be created **once**, and only while `ADMIN_SETUP_TOKEN` is set.
4. After that, sign in at **`/admin/login`**.

## Architecture

```
migrations/           D1 schema (0001_init) + settings seed (0002_seed)
src/server/           Cloudflare Worker (Hono)
  index.ts            route wiring, security headers, error handling
  lib/auth.ts         PBKDF2 (WebCrypto), sessions, requireAdmin, CSRF origin guard
  lib/validate.ts     input validation    lib/csv.ts  CSV export + formula-injection guard
  routes/public.ts    /api/public/*  config, lead registration, telegram-click, view, unsubscribe
  routes/auth.ts      /api/admin/auth/*  setup, login, logout, me, change-password
  routes/adminData.ts /api/admin/data/*  overview, leads, sales
  routes/growth.ts    /api/admin/growth/* campaigns, content generator + calendar
  routes/reports.ts   /api/admin/reports/*  CSV exports, audit, settings, integrations
src/app/              React 19 + React Router SPA (public pages + admin dashboard)
scripts/smoke-test.mjs  end-to-end acceptance tests (run against live workerd)
```

Static assets are served by the platform with SPA fallback (`wrangler.jsonc` assets config;
`run_worker_first: ["/api/*"]`); security headers for static responses come from `src/app/public/_headers`.

## Honesty rules baked into the product

- Telegram clicks are **never** treated as sales; the API response says so and the UI repeats it.
- A sale cannot be marked Confirmed/Paid without a stated **confirmation source**.
- No prices, performance statistics, testimonials, or product capabilities are invented — the Crypto Tools
  page uses explicit "pending supervisor confirmation" placeholders.
- Content is generated from **local educational templates** (no external AI service is called) and always
  carries a risk/not-financial-advice disclaimer.
- Publishing statuses (Draft/Scheduled/Published/Failed) reflect only what you declare; platform
  connections show **not_connected** until you record a verified connection.
- Analytics count only events captured by this system; no numbers are fabricated.

## Configuration checklist (you must provide)

| # | Item | Where | Notes |
|---|------|-------|-------|
| 1 | `ADMIN_SETUP_TOKEN` | `.dev.vars` locally; Sites → Secrets or `wrangler secret put` in production | Enables one-time admin creation at `/admin/setup`. **Change the dev value.** |
| 2 | Admin account | `/admin/setup` (once) | Your email + strong password. |
| 3 | Telegram handle | Settings → Brand & referral | Defaults to `Azriel_xoxo`; change only to a verified account. |
| 4 | Referral name | Settings → Brand & referral | Defaults to `Samjoe1234`. |
| 5 | Product/service details | Crypto Tools page copy | Replace placeholders once your supervisor confirms capabilities & prices. |
| 6 | Social platform API credentials | Growth Center → Platform connections | Required for *automated* publishing to Instagram/X/Facebook/email — not required for drafting/scheduling/manual publishing. |
| 7 | Production D1 database | `wrangler d1 create cryptotoolshubb` + migrations `--remote` | Local D1 is a dev-only file under `.wrangler/state`. |
| 8 | Deployment | `npx wrangler deploy` (or Freebuff Sites) | Not performed here — deploy when you're ready. |

## What works today (tested)

All 112 assertions in `npm run smoke` pass against a live workerd instance: registration, unique referral
IDs, duplicate handling, consent/validation enforcement, Telegram click tracking, auth + CSRF + audit,
lead editing, sales verification flow, campaigns, content statuses, all six CSV exports, unsubscribe,
security headers, and cross-session persistence in D1.
