-- Default settings (brand identity + supervisor Telegram contact).
-- Values are editable from the admin dashboard Settings screen.

INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
  ('brand_name', 'CryptoToolsHubb', '2026-10-01T00:00:00.000Z'),
  ('tagline', 'Smarter Crypto Tools. Better-Informed Decisions.', '2026-10-01T00:00:00.000Z'),
  ('telegram_username', 'Azriel_xoxo', '2026-10-01T00:00:00.000Z'),
  ('referral_name', 'Samjoe1234', '2026-10-01T00:00:00.000Z'),
  ('contact_email', '', '2026-10-01T00:00:00.000Z'),
  ('disclaimer_version', '2026-10-v1', '2026-10-01T00:00:00.000Z');

-- Integration status records start as not_connected. They only change when
-- the administrator records a verified connection.
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
  ('integration:telegram', '{"status":"not_connected","notes":"Public Telegram contact links work without credentials. Bot API is optional."}', '2026-10-01T00:00:00.000Z'),
  ('integration:instagram', '{"status":"not_connected","notes":"Requires a Meta developer app, Instagram Business account and approved permissions to publish via API."}', '2026-10-01T00:00:00.000Z'),
  ('integration:x', '{"status":"not_connected","notes":"Requires an X developer app and API keys to publish via API."}', '2026-10-01T00:00:00.000Z'),
  ('integration:facebook', '{"status":"not_connected","notes":"Requires a Meta developer app and Pages API access to publish via API."}', '2026-10-01T00:00:00.000Z'),
  ('integration:email', '{"status":"not_connected","notes":"Requires an email service provider API key. Unsubscribe handling is built in."}', '2026-10-01T00:00:00.000Z');
