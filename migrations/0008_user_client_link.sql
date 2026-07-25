-- Migration 0008: Link client users to their client account

ALTER TABLE users ADD COLUMN client_id TEXT;

-- Link existing client users to their client by matching org name to client name
UPDATE users SET client_id = (
  SELECT id FROM clients WHERE name = users.org LIMIT 1
)
WHERE role IN ('client_admin', 'client_user', 'client_approver')
  AND client_id IS NULL;
