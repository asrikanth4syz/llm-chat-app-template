-- Quick win: persist each user's preferred UI language on their profile (not just in
-- the browser), so it follows them across devices and logins. Fallback is English.
ALTER TABLE users ADD COLUMN lang TEXT NOT NULL DEFAULT 'en'; -- en | hi | kn

-- Org-level default UI language (admin-configurable). Stored as a config row reused by
-- the login screen's initial language before a user has a saved preference.
CREATE TABLE IF NOT EXISTS portal_config (
  key   TEXT PRIMARY KEY,
  value TEXT
);
INSERT OR IGNORE INTO portal_config (key, value) VALUES ('default_lang', 'en');
