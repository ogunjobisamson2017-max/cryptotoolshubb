# Deploy CryptoToolsHubb from GitHub (Cloudflare Workers Free + D1 Free)

This repo is ready to be connected to **Cloudflare Workers Builds** (Workers & Pages → Import a Git
repository). No API token has to be copied anywhere: Cloudflare creates the build token itself.

What already exists:

| Item | Value |
| --- | --- |
| Worker entry point | `src/server/index.ts` (Hono API + static assets) |
| D1 binding | `DB` |
| D1 database name | `cryptotoolshubb` |
| D1 database id | `bc27e7e6-f40b-41d9-8598-fe5a8b8df8cb` (already in `wrangler.jsonc`) |
| Frontend | React + Vite, builds to `dist/client` |
| Migrations | `migrations/0001_init.sql`, `migrations/0002_seed.sql` |

Do **not** commit `.dev.vars`. It is git-ignored; the production admin token is set as a Worker secret.

---

## 1. Put the code in a GitHub repository

1. On github.com (mobile browser works), create an empty **private** repository, e.g. `cryptotoolshubb`.
2. Open the repository → **Add file → Upload files**.
3. Upload the contents of this archive. Keep the folder structure (`src/`, `migrations/`, `scripts/`).
   The GitHub web uploader accepts up to 100 files at a time; this project has ~52, so one batch is enough.
   Upload folder-by-folder if the picker on your phone only allows files.
4. Commit to the `main` branch.

Never upload `node_modules/`, `dist/`, `.wrangler/` or `.dev.vars`.

## 2. Connect the repository to Cloudflare

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Workers** → **Import a repository**.
2. Authorize GitHub, pick the repository and the `main` branch.
3. Set:
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
   - **Root directory:** leave empty
4. Save and deploy. The first build installs from `package-lock.json`, type-checks nothing extra,
   builds `dist/client`, and uploads the Worker with the D1 binding + `ASSETS` binding.
5. Result URL: `https://cryptotoolshubb.<your-subdomain>.workers.dev`.

Free plan allowance for Workers Builds: 3,000 build minutes/month, 1 concurrent build.

## 3. Apply the database schema (once)

`wrangler deploy` does not apply D1 migrations. Choose one option.

**Option A — let the deploy command apply them (recommended, repeatable)**

1. Cloudflare dashboard → **My Profile → API Tokens**. Find the token Cloudflare created for
   Workers Builds, **Edit** it, and add **Account → D1 → Edit**. Save.
2. Worker → **Settings → Build** → set **Deploy command** to:

   ```
   npx wrangler d1 migrations apply DB --remote --yes && npx wrangler deploy
   ```

3. **Retry build**. Wrangler keeps a `d1_migrations` table, so already-applied migrations are skipped.

**Option B — run the SQL by hand in the dashboard**

1. Workers & Pages → **D1** → `cryptotoolshubb` → **Console**.
2. Paste the whole of `migrations/0001_init.sql`, run it, then paste and run `migrations/0002_seed.sql`.

Never run `--local` migrations against production; `npm run db:migrate:local` is for `wrangler dev` only.

## 4. Production runtime settings

| Name | How | Value |
| --- | --- | --- |
| `ADMIN_SETUP_TOKEN` | Worker → Settings → Variables and Secrets → **Secret** | a long random value you keep private; needed only to create the first admin at `/admin/setup` |
| `APP_ENV` | `wrangler.jsonc` → `vars` (currently `"local"`) | optional label only; set `"production"` if you want it tidy |
| `APP_ORIGIN` | same place, optional | only needed for a custom domain, e.g. `https://yourdomain.com`; on `*.workers.dev` the CSRF check falls back to the request host |

Secrets are not overwritten by `wrangler deploy`; `vars` in `wrangler.jsonc` are.

## 5. Verify

1. Open the `workers.dev` URL — the public site should load.
2. Open `/admin/setup`, enter `ADMIN_SETUP_TOKEN`, an email and a 12+ character password (letter + number).
   This works once; afterwards remove the secret if you want setup permanently disabled.
3. Sign in at `/admin`, then check leads, sales, growth and reports.

## Free-plan notes

- Workers Free: 100,000 requests/day. D1 Free: 5 GB storage, 5M rows read/day, 100k rows written/day.
- No Cron Triggers, Queues or paid add-ons are used by this project.
