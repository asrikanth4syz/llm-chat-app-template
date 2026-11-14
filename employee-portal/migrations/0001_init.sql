-- 4SYZ Employee Portal — R0 foundation schema.
-- Separate identity realm from SmartPantry (realm column pins it). Sensitive
-- columns (pan, bank_account, aadhaar_last4, ctc) are stored plaintext in this
-- scaffold ONLY; NFR-03 (R1) replaces them with field-level encryption. The
-- policy engine redacts them on read regardless.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  realm         TEXT NOT NULL DEFAULT 'employee-portal',
  email         TEXT,
  phone         TEXT,
  password_hash TEXT NOT NULL,          -- dev: 'SEED:<plaintext>'; replace with a real hash + SSO
  role          TEXT NOT NULL,          -- employee | manager | hr_admin | finance | it_admin | auditor | super_admin
  employee_id   TEXT,                   -- the employee record this login maps to (NULL for pure admins)
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(realm, lower(email));

CREATE TABLE IF NOT EXISTS employees (
  id            TEXT PRIMARY KEY,
  user_id       TEXT,
  manager_id    TEXT,                   -- self-reference: this employee's manager
  segment       TEXT NOT NULL DEFAULT 'office',   -- office | client_site
  name          TEXT NOT NULL,
  work_email    TEXT,
  designation   TEXT,
  location      TEXT,
  pan           TEXT,
  bank_account  TEXT,
  aadhaar_last4 TEXT,
  ctc           REAL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);

-- Append-only audit log: inserts only. Triggers block any update or delete, so
-- even the System Administrator cannot alter history (security review).
CREATE TABLE IF NOT EXISTS audit_log (
  id            TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  action        TEXT NOT NULL,          -- LOGIN | LIST | READ | READ_SENSITIVE | DENY
  resource      TEXT NOT NULL,
  resource_id   TEXT,
  detail        TEXT,
  at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at);
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_log
  BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_log
  BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;

-- Seed (dev): one super admin, one HR admin, one manager, two employees.
-- All dev passwords are 'pw123'.
INSERT OR IGNORE INTO employees (id, user_id, manager_id, segment, name, work_email, designation, location, pan, bank_account, aadhaar_last4, ctc) VALUES
  ('e_hr',    'u_hr',    NULL,      'office',      'Nita (HR)', 'hr@4syz.com',    'HR Admin',   'HSR',      'HRXXX1111A', '9001', '1111', 1400000),
  ('e_meera', 'u_meera', NULL,      'office',      'Meera',     'meera@4syz.com', 'Manager',    'HSR',      'LMNOP5555Q', '3333', '5555', 1800000),
  ('e_asha',  'u_asha',  'e_meera', 'office',      'Asha',      'asha@4syz.com',  'Analyst',    'HSR',      'ABCDE1234F', '1111', '4321', 950000),
  ('e_bala',  'u_bala',  'e_meera', 'client_site', 'Bala',      'bala@4syz.com',  'Technician', 'Client A', 'ZYXWV9876K', '2222', '8765', 600000);

INSERT OR IGNORE INTO users (id, realm, email, phone, password_hash, role, employee_id, active) VALUES
  ('u_root',  'employee-portal', 'admin@4syz.com', NULL,          'SEED:pw123', 'super_admin', NULL,      1),
  ('u_hr',    'employee-portal', 'hr@4syz.com',    NULL,          'SEED:pw123', 'hr_admin',    'e_hr',    1),
  ('u_meera', 'employee-portal', 'meera@4syz.com', NULL,          'SEED:pw123', 'manager',     'e_meera', 1),
  ('u_asha',  'employee-portal', 'asha@4syz.com',  NULL,          'SEED:pw123', 'employee',    'e_asha',  1),
  ('u_bala',  'employee-portal', 'bala@4syz.com',  '+910000000000','SEED:pw123', 'employee',    'e_bala',  1);
