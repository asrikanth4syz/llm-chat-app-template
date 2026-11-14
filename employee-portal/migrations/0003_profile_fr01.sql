-- FR-01 Profile + NFR-03 field-level encryption.
-- Self-service profile fields: an employee may edit these directly (audited).
ALTER TABLE employees ADD COLUMN phone TEXT;
ALTER TABLE employees ADD COLUMN personal_email TEXT;
ALTER TABLE employees ADD COLUMN address TEXT;
ALTER TABLE employees ADD COLUMN emergency_contact TEXT;

-- Controlled changes to identity/financial fields (bank account, PAN, Aadhaar)
-- do NOT apply immediately — they are verified by HR/super_admin first (FR-01).
-- Step-up authentication on these requests arrives in R2 (FR-26). The requested
-- new value is stored ENCRYPTED (NFR-03), never in plaintext.
CREATE TABLE IF NOT EXISTS profile_change_requests (
  id            TEXT PRIMARY KEY,
  employee_id   TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  field         TEXT NOT NULL,          -- bankAccount | pan | aadhaarLast4
  new_value_enc TEXT NOT NULL,          -- AES-GCM ciphertext envelope (v1:iv:ct)
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  reason        TEXT,
  requested_at  TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_by   TEXT,
  reviewed_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_pcr_employee ON profile_change_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_pcr_status ON profile_change_requests(status);
