-- CryptoToolsHubb — initial schema
-- All timestamps stored as ISO-8601 UTC strings (YYYY-MM-DDTHH:MM:SS.sssZ).

CREATE TABLE admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  iterations    INTEGER NOT NULL,
  role          TEXT NOT NULL DEFAULT 'owner',
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  admin_id   INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  ip         TEXT,
  user_agent TEXT
);
CREATE INDEX idx_sessions_admin ON sessions(admin_id);

-- Atomic sequence for referral IDs (CTH-000001 …)
CREATE TABLE counters (
  key   TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
INSERT INTO counters (key, value) VALUES ('lead_seq', 0);

CREATE TABLE campaigns (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  utm_source   TEXT NOT NULL,
  utm_medium   TEXT,
  utm_campaign TEXT,
  utm_content  TEXT,
  utm_term     TEXT,
  landing_path TEXT NOT NULL DEFAULT '/get-started',
  notes        TEXT,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX idx_campaigns_source ON campaigns(utm_source);

CREATE TABLE leads (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  referral_id       TEXT NOT NULL UNIQUE,
  first_name        TEXT NOT NULL,
  email             TEXT NOT NULL,
  email_normalized  TEXT NOT NULL UNIQUE,
  country           TEXT NOT NULL,
  interest          TEXT NOT NULL,
  contact_method    TEXT,
  consent_at        TEXT,
  consent_version   TEXT,
  status            TEXT NOT NULL DEFAULT 'New',
  notes             TEXT,
  source            TEXT,
  medium            TEXT,
  campaign          TEXT,
  ref_code          TEXT,
  landing_page      TEXT,
  referrer          TEXT,
  campaign_id       INTEGER REFERENCES campaigns(id),
  unsubscribed      INTEGER NOT NULL DEFAULT 0,
  unsubscribe_token TEXT NOT NULL UNIQUE,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX idx_leads_created ON leads(created_at);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_campaign ON leads(campaign);
CREATE INDEX idx_leads_source ON leads(source);

CREATE TABLE telegram_clicks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id      INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  referral_id  TEXT,
  clicked_at   TEXT NOT NULL,
  source       TEXT,
  medium       TEXT,
  campaign     TEXT,
  landing_page TEXT,
  user_agent   TEXT
);
CREATE INDEX idx_tg_clicks_time ON telegram_clicks(clicked_at);
CREATE INDEX idx_tg_clicks_ref ON telegram_clicks(referral_id);

CREATE TABLE sales (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  referral_id        TEXT NOT NULL,
  lead_id            INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  customer_label     TEXT NOT NULL,
  product_name       TEXT NOT NULL,
  sale_date          TEXT NOT NULL,
  sale_amount_usd    REAL NOT NULL,
  commission_usd     REAL NOT NULL,
  payment_status     TEXT NOT NULL DEFAULT 'Pending',
  confirmation_source TEXT,
  notes              TEXT,
  confirmed_at       TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  created_by         INTEGER REFERENCES admins(id)
);
CREATE INDEX idx_sales_ref ON sales(referral_id);
CREATE INDEX idx_sales_status ON sales(payment_status);
CREATE INDEX idx_sales_date ON sales(sale_date);

CREATE TABLE content_drafts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  platform       TEXT NOT NULL,
  content_type   TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'Draft',
  hashtags       TEXT,
  scheduled_at   TEXT,
  published_at   TEXT,
  publish_url    TEXT,
  failure_reason TEXT,
  campaign_id    INTEGER REFERENCES campaigns(id),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  created_by     INTEGER REFERENCES admins(id)
);
CREATE INDEX idx_content_status ON content_drafts(status);
CREATE INDEX idx_content_scheduled ON content_drafts(scheduled_at);

CREATE TABLE page_views (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  path       TEXT NOT NULL,
  source     TEXT,
  medium     TEXT,
  campaign   TEXT,
  ref_code   TEXT,
  day        TEXT NOT NULL,
  viewed_at  TEXT NOT NULL
);
CREATE INDEX idx_views_day ON page_views(day);
CREATE INDEX idx_views_campaign ON page_views(campaign);

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id    INTEGER,
  admin_email TEXT,
  action      TEXT NOT NULL,
  entity      TEXT,
  entity_id   TEXT,
  detail      TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_audit_time ON audit_logs(created_at);
