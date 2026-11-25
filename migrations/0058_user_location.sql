-- Bind users to a specific client LOCATION, not just the client.
-- Mirrors the runtime self-heal in ensureClientLocationSchema / ensureUserLocationBackfill
-- (the deploy pipeline does not apply migrations/*.sql, so that path is authoritative;
-- this file keeps a fresh DB in sync).

-- Account-level location records (created at runtime for existing DBs).
CREATE TABLE IF NOT EXISTS client_locations (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  shipping_address TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  zoho_address_id TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_client_locations_client ON client_locations (client_id);
-- A location's display name is required (NOT NULL above) and unique within its client.
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_locations_disp ON client_locations (client_id, display_name);

-- Each user may belong to one client location.
ALTER TABLE users ADD COLUMN location_id TEXT;

-- Backfill: link existing client users to their client's default location where one exists.
UPDATE users SET location_id = (
  SELECT cl.id FROM client_locations cl
  WHERE cl.client_id = users.client_id
  ORDER BY cl.is_default DESC, cl.created_at ASC LIMIT 1)
WHERE client_id IS NOT NULL AND client_id <> ''
  AND (location_id IS NULL OR location_id = '')
  AND EXISTS (SELECT 1 FROM client_locations cl2 WHERE cl2.client_id = users.client_id);
