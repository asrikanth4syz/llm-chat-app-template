-- Migration 0003: features 16-25

-- Feature 16: Delivery route optimization
CREATE TABLE IF NOT EXISTS delivery_routes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  route_date TEXT NOT NULL,
  stops TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'PLANNED',
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Feature 17: Dunning rules and events
CREATE TABLE IF NOT EXISTS dunning_rules (
  id TEXT PRIMARY KEY,
  days_overdue INTEGER NOT NULL,
  action TEXT NOT NULL,
  message_template TEXT,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS dunning_events (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  order_id TEXT,
  action_taken TEXT NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Feature 18: Import jobs
CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DONE',
  total INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  errors TEXT DEFAULT '[]',
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Feature 19: Order and PO templates
CREATE TABLE IF NOT EXISTS order_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  client_id TEXT,
  items TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS po_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  vendor_id TEXT,
  items TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Feature 20: Vendor feedback/ratings
CREATE TABLE IF NOT EXISTS vendor_feedback (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL,
  po_id TEXT,
  grn_id TEXT,
  quality_rating INTEGER NOT NULL DEFAULT 3,
  delivery_rating INTEGER NOT NULL DEFAULT 3,
  service_rating INTEGER NOT NULL DEFAULT 3,
  comments TEXT,
  submitted_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Feature 21: SLA rules and breaches
CREATE TABLE IF NOT EXISTS sla_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'order',
  trigger_status TEXT NOT NULL,
  max_hours INTEGER NOT NULL,
  action TEXT NOT NULL DEFAULT 'NOTIFY',
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sla_breaches (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'order',
  breached_at TEXT DEFAULT (datetime('now')),
  resolved_at TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN'
);

-- Feature 22: 2FA on users
ALTER TABLE users ADD COLUMN two_fa_enabled INTEGER DEFAULT 0;

-- Feature 23: Credit limits on clients
ALTER TABLE clients ADD COLUMN credit_limit REAL DEFAULT 0;
ALTER TABLE clients ADD COLUMN credit_used REAL DEFAULT 0;

-- Feature 24: Multi-level approval chains
CREATE TABLE IF NOT EXISTS approval_chains (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'order',
  min_amount REAL DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS approval_chain_steps (
  id TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  role TEXT NOT NULL,
  label TEXT
);

CREATE TABLE IF NOT EXISTS approval_chain_instances (
  id TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'order',
  current_step INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS approval_chain_actions (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  action TEXT NOT NULL,
  comments TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Seed data

-- Feature 17: Dunning rules
INSERT OR IGNORE INTO dunning_rules VALUES ('dr1',30,'EMAIL','Dear client, your payment is 30 days overdue. Please settle immediately.',1);
INSERT OR IGNORE INTO dunning_rules VALUES ('dr2',60,'SMS','Payment 60 days overdue. Escalation imminent unless settled.',1);
INSERT OR IGNORE INTO dunning_rules VALUES ('dr3',90,'ESCALATE','Account escalated to collections. 90 days overdue.',1);

-- Feature 21: SLA rules
INSERT OR IGNORE INTO sla_rules VALUES ('sr1','Order Acknowledgement','order','SUBMITTED',4,'NOTIFY',1);
INSERT OR IGNORE INTO sla_rules VALUES ('sr2','Approval SLA','order','PENDING_APPROVAL',8,'NOTIFY',1);
INSERT OR IGNORE INTO sla_rules VALUES ('sr3','Inventory Check SLA','order','ACKNOWLEDGED',24,'NOTIFY',1);
INSERT OR IGNORE INTO sla_rules VALUES ('sr4','Delivery SLA','order','READY_TO_PICK',48,'NOTIFY',1);

-- Feature 24: Approval chain for large orders (>5L)
INSERT OR IGNORE INTO approval_chains VALUES ('ac1','Large Order Approval (>5L)','order',500000,1,datetime('now'));
INSERT OR IGNORE INTO approval_chain_steps VALUES ('acs1','ac1',1,'client_approver','Level 1 - Client Approver');
INSERT OR IGNORE INTO approval_chain_steps VALUES ('acs2','ac1',2,'client_admin','Level 2 - Client Admin');
INSERT OR IGNORE INTO approval_chain_steps VALUES ('acs3','ac1',3,'ops_admin','Level 3 - Ops Admin');

-- Feature 23: Set default credit limits for existing clients
UPDATE clients SET credit_limit=500000 WHERE credit_limit=0;
