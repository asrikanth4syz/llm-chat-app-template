-- Admin-configurable resignation-date mode (single source of truth in portal_config; the UI and
-- the backend both read these keys — neither rule is hardcoded).
--   resign_allow_future: '0' = OFF (yesterday or earlier, the default) · '1' = ON (today..+max)
--   resign_max_future_days: upper bound (days from today) when the toggle is ON
INSERT OR IGNORE INTO portal_config (key, value) VALUES ('resign_allow_future', '0');
INSERT OR IGNORE INTO portal_config (key, value) VALUES ('resign_max_future_days', '90');

-- Record which mode was active when each resignation was submitted (for audit).
ALTER TABLE resignations ADD COLUMN date_mode TEXT;  -- 'past_only' | 'future_allowed'
