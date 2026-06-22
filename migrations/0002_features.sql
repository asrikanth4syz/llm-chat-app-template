-- Migration 0002: gaps 5,6,7,9,13,14,15

-- Gap 5: Warehouses & bin locations
CREATE TABLE IF NOT EXISTS warehouses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  address TEXT,
  capacity INTEGER DEFAULT 1000,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS bin_locations (
  id TEXT PRIMARY KEY,
  warehouse_id TEXT NOT NULL,
  code TEXT NOT NULL,
  zone TEXT,
  sku TEXT,
  capacity INTEGER DEFAULT 100,
  occupied INTEGER DEFAULT 0
);

-- Gap 6: Approval rules
CREATE TABLE IF NOT EXISTS approval_rules (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  category TEXT,
  min_amount REAL DEFAULT 0,
  max_amount REAL,
  approver_role TEXT DEFAULT 'client_approver',
  auto_approve INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);

-- Gap 7: Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_value TEXT,
  new_value TEXT,
  ip TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Gap 9: Stock reservation column
ALTER TABLE inventory ADD COLUMN reserved INTEGER DEFAULT 0;

-- Gap 13: OTP store
CREATE TABLE IF NOT EXISTS otp_store (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER DEFAULT 0
);

-- Gap 14: Partial delivery tracking
ALTER TABLE delivery_challans ADD COLUMN total_qty INTEGER DEFAULT 0;
ALTER TABLE delivery_challans ADD COLUMN delivered_qty INTEGER DEFAULT 0;

-- Gap 15: Order comments
CREATE TABLE IF NOT EXISTS order_comments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Gap 6: Seed approval rules
INSERT OR IGNORE INTO approval_rules VALUES ('ar1',NULL,NULL,0,100000,'client_approver',0,1);
INSERT OR IGNORE INTO approval_rules VALUES ('ar2',NULL,NULL,100000,500000,'client_admin',0,1);
INSERT OR IGNORE INTO approval_rules VALUES ('ar3',NULL,NULL,0,5000,'client_approver',1,1);

-- Gap 5: Seed warehouses
INSERT OR IGNORE INTO warehouses VALUES ('wh1','Mumbai Central Warehouse','Mumbai','Plot 14, MIDC, Andheri East, Mumbai 400093',2000,1);
INSERT OR IGNORE INTO warehouses VALUES ('wh2','Bangalore Hub','Bangalore','Survey No. 88, Whitefield Industrial Area, Bengaluru 560066',1500,1);
INSERT OR IGNORE INTO warehouses VALUES ('wh3','Delhi NCR Facility','Gurugram','Sector 35, Industrial Model Township, Gurugram 122001',1200,1);

-- Gap 5: Seed bin locations
INSERT OR IGNORE INTO bin_locations VALUES ('b1','wh1','A-01-01','Zone A','SKU001',100,45);
INSERT OR IGNORE INTO bin_locations VALUES ('b2','wh1','A-01-02','Zone A','SKU002',200,128);
INSERT OR IGNORE INTO bin_locations VALUES ('b3','wh1','B-02-01','Zone B','SKU004',150,34);
INSERT OR IGNORE INTO bin_locations VALUES ('b4','wh2','A-01-01','Zone A','SKU007',300,156);
INSERT OR IGNORE INTO bin_locations VALUES ('b5','wh2','A-02-01','Zone A','SKU008',200,92);
INSERT OR IGNORE INTO bin_locations VALUES ('b6','wh3','A-01-01','Zone A','SKU005',400,210);

-- Gap 7: Seed some audit logs
INSERT OR IGNORE INTO audit_logs VALUES ('al1','u2','Arjun Mehta','TRANSITION','order','SP-2406-0891','SUBMITTED','ACKNOWLEDGED',NULL,datetime('now','-1 day'));
INSERT OR IGNORE INTO audit_logs VALUES ('al2','u9','Divya Nair','TRANSITION','order','SP-2406-0891','PENDING_APPROVAL','APPROVED',NULL,datetime('now','-2 days'));
INSERT OR IGNORE INTO audit_logs VALUES ('al3','u4','Ravi Kumar','CREATE','grn','GRN-0001',NULL,'qty:150',NULL,datetime('now','-3 days'));

-- Gap 15: Seed a comment
INSERT OR IGNORE INTO order_comments VALUES ('oc1','SP-2406-0891','u2','Arjun Mehta','Urgent — client requested delivery before EOD Friday.',datetime('now','-1 day'));
