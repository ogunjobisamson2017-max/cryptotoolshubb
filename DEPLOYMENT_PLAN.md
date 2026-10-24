# CryptoToolsHubb — Production Launch Plan

**Do not run any deploy command yet.** This plan is for your review and approval first. Deploying, creating production resources, or rotating secrets happens only after you OK it.

---

## 1. What this project is (so the right host is chosen)

| Layer | Technology | Where it runs |
|---|---|---|
| Frontend | React 19 SPA built by Vite → `dist/client/` | Static assets |
| Backend | Cloudflare Worker (Hono) — `src/server/index.ts` | Edge compute |
| Database | D1 (SQLite) — persistent, keyed by `DB` binding | Cloudflare D1 |
| Auth | PBKDF2 password hashes + DB-backed sessions (12h cookie) | Worker |
| Static headers | `src/app/public/_headers` | Served by platform |

The platform already requires HTTPS for the worker URL — the Worker binds to Cloudflare's managed origin automatically.

---

## 2. Recommended hosting option for this exact stack

**Cloudflare Workers + D1 (Workers mode)** is the correct home for this stack — the code is already written as a Workers-compatible ES module, it has a D1 binding, and wrangler is already configured for it.

Two ways to deploy, both use the same worker and D1:

- **Freebuff Sites** — if you want the site managed through Freebuff. Sites gives you Worker + D1/R2 bindings per environment (preview/production), plus Sign in with Freebuff if you ever want identity managed by the platform instead of your own admin DB. Today this project uses its **own** admin auth, so Freebuff auth is optional, not required.
- **Direct Cloudflare Workers deploy** — `npx wrangler deploy` against a Cloudflare account you control. Same worker, same D1. You would create the D1 database and insert secrets under your own account.

**Recommendation:** Use whichever Cloudflare account you already use (or are OK creating). The worker code does not care which deploy path; the only differences are where the D1 ID and the secrets live.

---

## 3. What must exist before the first production deploy

1. **A Cloudflare account** (or a Freebuff Sites project backed by one). No additional third-party services are required to launch the core site — Telegram handles are public links, content is generated from local templates, no external AI/email/social API keys are needed for the working build.
2. **A production D1 database** — separate from the local dev database. Do **not** point production at the local `.wrangler/state` file.
3. **Production wrangler configuration** — `wrangler.jsonc` must reference the real production D1 `database_id` instead of the local placeholder.
4. **Production secrets** — `ADMIN_SETUP_TOKEN` (a strong random value) and the environment marker, set as worker secrets, not committed to the repo.
5. **(Optional) A chosen production origin/domain** — if you use a custom domain through Cloudflare, so `APP_ORIGIN` can be set for CSRF origin checks and cookie `secure` enforcement.

---

## 4. Production database — created without touching dev data

**This plan never creates, copies, replaces, or deletes the local development database.** The dev database lives under `.wrangler/state/` on this machine. Production uses a separate D1 database created through wrangler against your Cloudflare account.

### Steps (run on your machine from the project root, after you've `wrangler login`'d to the Cloudflare account you want to use)

```bash
# 1. One-time: create the production D1 database (separate resource from dev)
npx wrangler d1 create cryptotoolshubb
```

The command prints a `database_id` (a UUID). **Replace the placeholder in `wrangler.jsonc`:**

- In `wrangler.jsonc`, the D1 entry currently has `"database_id": "local-dev-placeholder"`. Set it to the new production `database_id`.
- Keep the binding name `DB` and `database_name` `cryptotoolshubb` as they are (code and migrations already target them).

```bash
# 2. Apply the migrations to the production D1 (this is what seeds the schema)
npx wrangler d1 migrations apply cryptotoolshubb --remote
```

Migrations are idempotent by name — `0001_init.sql` creates the schema, `0002_seed.sql` inserts the default brand/Telegram/settings rows if missing (`INSERT OR IGNORE`). Nothing in production will be touched by these commands; they only touch the new production database you just created.

**Important:** Do not run any command that lists, dumps, exports, or overwrites the local dev database as part of this. Do not copy the local db into production by hand — the proper way is the remote migration apply above, which is what the build already expects.

---

## 5. Replace the development ADMIN_SETUP_TOKEN with a production secret

Today: `.dev.vars` contains `ADMIN_SETUP_TOKEN=local-dev-setup-token-change-me`. This is a **dev-only** file (git-ignored) used only by `wrangler dev` locally. The value is weak and must not reach production.

### What changes for production

- The production worker gets its own secret value, set with wrangler's secret command (or the hosting dashboard), **not** written into `.dev.vars`, not committed to git, and not printed into this plan.
- The dev secret is left alone for local development.

### How to set it (your machine, Cloudflare account you're deploying to)

```bash
# Generate a strong token on your side, keep it out of logs and history:
#   Linux/macOS:  ADMIN_SETUP_TOKEN="$(openssl rand -hex 24)"
#   Or use:        ADMIN_SETUP_TOKEN="$(python3 -c "import secrets; print(secrets.token_hex(24))")"
# Do NOT paste the value here. Set it only via the secret tooling below.

# Set the production secret (writes only to the deployed worker's secret store):
npx wrangler secret put ADMIN_SETUP_TOKEN
# wrangler will prompt you to paste the value; paste the generated token and confirm.
```

Also set the environment marker as a production secret (so the app knows it is production, which matters for cookie security below):

```bash
npx wrangler secret put APP_ENV
# paste: production
```

Do **not** chmod/chown or otherwise tangle `.dev.vars` into the production deploy. The dev file stays on this machine for `wrangler dev` only.

### Why this matters

- `assertSetupAllowed` requires `env.ADMIN_SETUP_TOKEN` to be present; if it is absent, setup returns **503 setup_disabled**, so an omitted or empty token cannot accidentally enable setup.
- The setup route compares the submitted token to the **exact** configured secret and rejects mismatches with 403, logging the failure.
- Because the production secret is set only in the worker secret store and never written anywhere else, there is no way for the dev token or any other leaked value to reach production.

---

## 6. Ensure the dev token cannot be used for first-run setup in production

This is satisfied by the token replacement above plus the code behavior:

- `/api/admin/auth/setup` calls `assertSetupAllowed`, which reads `env.ADMIN_SETUP_TOKEN` (the production secret, once set).
- The submitted token is compared with strict equality to that production secret.
- The dev value `local-dev-setup-token-change-me` is **not** set as a production secret, so it will not match anything in production. It will be rejected as "Setup token is invalid." (403) and audited.
- Once the first admin account is created, `/admin/setup-status` returns `needsSetup: false`, and subsequent `/setup` calls return **409 Setup already completed.** — regardless of token.

So, on a correctly-configured production worker:

- The dev token is useless (not a configured secret).
- The real production token works exactly once to create the first admin.
- After that, setup is permanently locked until you delete the admin and re-set the token (which you would not do in normal operation).

---

## 7. HTTPS, session cookies, authentication, and database access controls

### HTTPS

- A deployed Worker runs behind Cloudflare and is served over HTTPS at the Workers URL (and any custom domain you add through Cloudflare). The public site needs no separate TLS setup.
- `src/app/public/_headers` applies standard security headers to static responses; the Worker also applies them via middleware for API responses.

### Secure session cookies

- The session cookie is set with `httpOnly: true`, `sameSite: "Lax"`, `secure: true`, `path: "/"`.
- This means: JavaScript on the page cannot read the session token; the cookie is only sent on same-site requests (or top-level navigations for Lax); and it is only sent over HTTPS. That is correct for production.
- **One thing to confirm:** `secure: true` is set unconditionally in code. In production that is correct. If you ever test locally over plain HTTP, the secure cookie will not be set (that is expected; do not relax `secure` for production to accommodate local HTTP).

### Cookie domain / origin

- The cookie uses the default path-based scope with `sameSite: Lax`, which is appropriate for a single-origin admin app.
- CSRF protection: all admin mutations (`/api/admin/data/*`, `/api/admin/growth/*`, `/api/admin/reports/*`, `change-password`) go through `requireSameOrigin`, which requires a matching `Origin` header on unsafe methods. This blocks cross-origin mutation attempts even if a cookie were somehow sent.

### Authentication

- Admin passwords are hashed with PBKDF2-SHA256 at 210,000 iterations with a per-account random salt, stored in D1. Plaintext passwords are never stored or logged.
- Sessions are stored in D1 with a hashed token; the plain token is only ever in the httponly cookie.
- Login is rate-limited per IP (10 per 10 minutes) and every failure is audited.
- Password change revokes other sessions but keeps the current device signed in.
- `requireAdmin` middleware protects all admin data/growth/reports routes; unauthenticated access returns 401.

### Database access controls

- The Worker is the only process that talks to D1. There is no client-side database access, no exposed DB credentials, no direct SQL access from the browser.
- All reads/writes go through parameterized D1 prepared statements (no string-built SQL from user input).
- Row-level access is enforced by the API: leads/sales/growth/reports all go through the admin session guard; public routes return only non-sensitive config and accept/return only the data they are supposed to.
- CSV exports use a formula-injection guard (cells starting with `= + - @ tab CR` are prefixed with `'`).

---

## 8. Will the public registration, referral IDs, Telegram link, and admin dashboard work in production?

**Yes — with no code changes.**

- **Public registration** (`/api/public/leads`): validates input server-side, resolves campaigns, allocates a unique `CTH-######` ID from an atomic counter with a unique-index backstop (duplicate IDs impossible), stores the lead in D1, returns the ID and an unsubscribe token. Idempotent for duplicate emails (returns the existing ID).
- **Referral ID generation**: works the same in production — the counter is in the production D1 and the unique index is in the production schema.
- **Telegram link**: built client-side from the public config (`/api/public/config`) as `https://t.me/{handle}?text=...`. The prefilled message includes the referral ID, referral name, and brand. The user must press Send. No credentials, no publish, no guarantee of sending.
- **Telegram click tracking**: a separate event in `telegram_clicks`, never conflated with sales.
- **Admin dashboard** (`/admin`): authenticates via session cookie, reads/writes D1, renders via the same React SPA. All admin routes are guarded by `requireAdmin` + CSRF origin checks. CSV exports, campaigns, content, settings, integrations, audit log all work in production the same way.

**Nothing in the public site or admin depends on local dev specifics.** The only environment-specific pieces are the secrets and the D1 binding, which are environment config, not code changes.

---

## 9. Costs, accounts, and dependencies before deployment

### Accounts required

- **A Cloudflare account** (Workers + D1). This is the only hosting account required for the core working build.
- Optionally, a **Freebuff account** if you prefer to deploy through Freebuff Sites instead of directly through Cloudflare. Freebuff Sites wraps the same Workers + D1 model.

### Services not required to launch the working build (so no accounts/costs for these yet)

- **Telegram bot API** — not required. The Telegram contact link uses a public `t.me` deep link; no bot token needed.
- **Meta (Instagram/Facebook) developer app, X developer app, email provider** — not required to launch. The Growth Center drafts and schedules content and shows platform connections as `not_connected` until you record a verified connection. Automated publishing to those platforms requires their developer apps and approved permissions, which you would add later.
- **Any external AI/LLM service** — not used. Content is generated from local educational templates.

### Potential costs (Cloudflare, approximate — confirm in your account before deploying)

- **Workers:** Workers has a generous free tier; traffic and CPU beyond the free allowance are billed per-request and per-compute-unit. A lead-gen site with modest traffic typically fits within or near the free tier; confirm your expected traffic.
- **D1:** D1 has a free tier with hourly and daily read/write limits and storage; beyond that, additional storage and reads/writes are billed. Backups/serialization can incur storage costs at scale. Confirm limits for your expected usage.
- **Custom domain / Workers Domains:** Using a Workers custom domain or a domain you proxy through Cloudflare may have its own considerations; a free `*.workers.dev` subdomain is available for testing.
- **Outbound data / egress:** Normal site traffic is small; CSV exports are the largest responses but still modest per export.

**Do not deploy anything that could incur charges until you have reviewed Cloudflare's current pricing for Workers and D1 in your account and confirmed it is acceptable.** This plan does not deploy and does not create any resources.

---

## 10. Outstanding issues / things to double-check before launch

1. **Production `APP_ORIGIN` (recommended):** If you will use a custom domain (not just `*.workers.dev`), set `APP_ORIGIN` as a production secret to the canonical origin (scheme + host, no path), e.g. `https://yourdomain.com`. This makes CSRF origin checks and cookie secure enforcement operate against your real public origin. If you launch on `*.workers.dev` only, the origin check still works because it falls back to comparing against the request host.
2. **Cookie secure flag:** Confirm you will serve production over HTTPS (the Worker is always HTTPS, so this should be automatic). If you test on a non-HTTPS origin, the session cookie will not set — that is expected and is not a bug.
3. **Admin setup secrecy:** After the first admin is created, the setup endpoint is locked. Make sure you create your admin account on the production worker **before** any wider promotion, and that you know your admin email/password (store them securely; I will never store or repeat them).
4. **Brand content placeholders:** The Crypto Tools page still contains explicit "pending supervisor confirmation" placeholders for product capabilities/prices. Replace them with verified information before promoting the page, so you are not presenting unverified specifics as facts.
5. **Telegram handle and referral name:** Defaults are `Azriel_xoxo` and `Samjoe1234`. Change these in Settings only to verified values.
6. **Privacy/legal pages:** They exist and are linked from the footer and Get Started. Review them against your actual practices before launch (they are template content written to be reasonable, not legal advice).
7. **`vercel`-style rewrite rules are not present:** This is a Workers SPA with `run_worker_first: ["/api/*"]` and `_headers` for static files. If you ever add other hosting, you would need equivalent SPA fallback + header rules. For Cloudflare Workers, the current config is correct as-is.

None of the above are blockers for deploying the working build. Items 1–4 are the most important to decide before promoting the site.

---

## 11. Deployment checklist

### Pre-deploy (do not deploy yet)

- [ ] You have reviewed Cloudflare Workers + D1 pricing/current limits for your expected traffic and confirmed you are comfortable.
- [ ] You have decided: deploy directly via Cloudflare Workers, or via Freebuff Sites. (Both use the same worker + D1; pick one.)
- [ ] You have decided whether to use a custom domain or the Workers `*.workers.dev` URL for now.
- [ ] You have decided on `APP_ORIGIN` (required if custom domain; optional if `*.workers.dev` only).

### Secrets (before deploy)

- [ ] Generate a strong random `ADMIN_SETUP_TOKEN` on your machine (do not paste it anywhere; do not commit it).
- [ ] Generate the value and set it as a **production** worker secret via `wrangler secret put ADMIN_SETUP_TOKEN` (or the hosting dashboard equivalent). The dev `.dev.vars` value is NOT used in production.
- [ ] Set `APP_ENV=production` as a production secret.
- [ ] If using a custom domain, set `APP_ORIGIN=https://yourdomain.com` as a production secret.

### Database (before deploy)

- [ ] Create the production D1 database: `npx wrangler d1 create cryptotoolshubb` → copy the new `database_id`.
- [ ] Update `wrangler.jsonc`: replace `"database_id": "local-dev-placeholder"` with the new production `database_id`.
- [ ] Apply migrations remotely: `npx wrangler d1 migrations apply cryptotoolshubb --remote`. (This creates the schema + default settings in the new production DB. It does not touch the local dev DB.)
- [ ] Confirm the production DB now has the schema and the default settings rows (brand name, tagline, Telegram handle, referral name, integrations all `not_connected`).

### Build (before deploy)

- [ ] `npm run build` succeeds (React SPA → `dist/client/`).
- [ ] `npm run typecheck` passes (server + client).
- [ ] Optionally run the smoke suite against a local workerd instance first (requires a running local dev server with a fresh/representative DB) to confirm nothing regressed since the last verified run. This is optional at launch; the build + typecheck are the minimum.

### Deploy (only after you approve)

- [ ] Deploy the worker + assets: `npx wrangler deploy` (or the Freebuff Sites deploy flow), targeting the production environment you want.
- [ ] After deploy, confirm the worker is reachable over HTTPS at its URL.

### Post-deploy verification (after deploy, before promoting)

- [ ] `GET /api/public/config` returns `brandName`, `tagline`, `telegramUsername`, `referralName` from the production DB (not empty).
- [ ] `GET /api/admin/auth/setup-status` returns `needsSetup: true` (no admin yet) and `setupTokenRequired: true`.
- [ ] `POST /api/admin/auth/setup` with the **dev** token is rejected (403) — confirms dev token cannot reach production.
- [ ] `POST /api/admin/auth/setup` with the **production** token + your email + valid password (12+ chars, letter + number) creates the admin and returns 201 with your admin info.
- [ ] `GET /api/admin/auth/setup-status` now returns `needsSetup: false`.
- [ ] `POST /api/admin/auth/login` with your email + password returns your session cookie.
- [ ] `GET /api/admin/data/overview` returns totals (currently 0 sales/commissions unless you migrated data — see below).
- [ ] Visit `/admin` in a browser with the session cookie → dashboard renders.
- [ ] Visit `/get-started` → registration form works, returns a `CTH-######` ID.
- [ ] Visit `/get-started` again with the same email → returns the same ID (duplicate handling).
- [ ] Click the Telegram button on a lead's confirmation → opens `t.me/{handle}` with prefilled message; clicking it records a `telegram_clicks` row (check in Leads' telegram_clicks count).
- [ ] Export a CSV from the admin (e.g. Leads) → downloads a real CSV with the formula guard, no template-only rows.
- [ ] Confirm static pages (`/`, `/crypto-tools`, `/crypto-research`, `/privacy`, `/terms`, `/risk-disclaimer`, `/contact`, `/unsubscribe`) return 200 and the SPA renders.

### Optional: migrate existing dev data to production (only if you want your existing leads/sales there)

The production DB starts empty (schema + default settings only). If you want the existing dev leads/sales/commissions/content/campaigns in production:

- [ ] Dump the local dev D1 data and apply it to the production D1. **Do not do this via the deploy flow;** it is a separate data migration step. The cleanest safe approach is to export from the local D1 and insert into the production D1 via `wrangler d1 execute` with batched INSERTs, or a D1 backup/restore if your Cloudflare plan supports it.
- [ ] If you do migrate, **do not overwrite the production schema** — only insert data. The schema is already there from the remote migration apply.
- [ ] After migration, verify a few known records (e.g. your CTH-000001 lead) appear in the production Leads list.

If you do not want to migrate dev data, leave production empty — that is the cleanest first-launch state and is fully supported.

### Post-launch

- [ ] Store your admin email + password securely (password manager). I do not store or repeat it.
- [ ] Set platform integrations to the correct status in Settings only when you have actually configured them (Instagram/X/Facebook/email require their own developer setups; Telegram contact link works without credentials).
- [ ] Replace Crypto Tools page placeholders with verified product details.
- [ ] Review privacy/terms/disclaimer against your real practices.
- [ ] Monitor the first few days of registration + Telegram clicks against the dashboard; confirm attribution (UTM params) flows as expected for any campaign links you distribute.

---

## 12. Summary

- **Hosting:** Cloudflare Workers + D1 is the right home; no other platform is needed for the working build.
- **Prod database:** create a new D1, point `wrangler.jsonc` at its new `database_id`, apply migrations `--remote`. Dev DB stays untouched.
- **Prod secret:** generate a strong random `ADMIN_SETUP_TOKEN`, set it + `APP_ENV=production` (and `APP_ORIGIN` if custom domain) as production worker secrets. Dev token stays in `.dev.vars` only, never reaches production.
- **Setup lock:** dev token is rejected in production by design; the real token works once, then setup is locked.
- **Security:** HTTPS is automatic; session cookies are httponly/samesite/secure; auth is PBKDF2 + DB sessions; CSRF origin checks cover admin mutations; D1 is only accessed by the Worker via parameterized queries; CSV has formula injection guard.
- **Public + admin features:** all work in production without code changes.
- **Costs/accounts:** you need a Cloudflare account (or Freebuff Sites). No external API keys are required to launch; social/email integrations are optional and not connected until you configure and verify them.
- **This plan does not deploy, create resources, or incur charges.** It is here for your review first.

---

*Generated from the current project state. No secrets or credentials are written, stored, or deployed by this plan or by me.*
