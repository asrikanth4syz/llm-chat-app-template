-- Smart Pantry D1 Schema + Seed Data

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  org TEXT NOT NULL,
  initials TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_name TEXT,
  health_score INTEGER DEFAULT 85,
  monthly_budget REAL DEFAULT 500000,
  spent_this_month REAL DEFAULT 0,
  approval_threshold REAL DEFAULT 100000,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  subtotal REAL DEFAULT 0,
  gst REAL DEFAULT 0,
  grand_total REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS order_history (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory (
  sku TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit_price REAL NOT NULL,
  stock INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 20,
  max_stock INTEGER DEFAULT 200,
  vendor_id TEXT,
  hsn_code TEXT DEFAULT '2101',
  gst_rate REAL DEFAULT 18,
  emoji TEXT DEFAULT '📦',
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  on_time_rate REAL DEFAULT 0,
  fill_rate REAL DEFAULT 0,
  avg_lead_days REAL DEFAULT 3,
  rating REAL DEFAULT 4.0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL,
  order_id TEXT,
  status TEXT DEFAULT 'SENT',
  subtotal REAL DEFAULT 0,
  gst REAL DEFAULT 0,
  grand_total REAL DEFAULT 0,
  expected_delivery TEXT,
  notes TEXT,
  invoice_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS po_items (
  id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS delivery_challans (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  po_id TEXT,
  status TEXT DEFAULT 'DISPATCHED',
  dispatched_at TEXT DEFAULT (datetime('now')),
  delivered_at TEXT,
  billed INTEGER DEFAULT 0,
  billed_at TEXT,
  vehicle_no TEXT,
  driver_name TEXT,
  driver_phone TEXT
);

CREATE TABLE IF NOT EXISTS grn_records (
  id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL,
  received_at TEXT DEFAULT (datetime('now')),
  received_by TEXT,
  qty_received INTEGER DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  raised_by TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'MEDIUM',
  status TEXT DEFAULT 'OPEN',
  created_at TEXT DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_role TEXT,
  message TEXT NOT NULL,
  read_flag INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ── Seed: Users (password = "password" hashed via PBKDF2) ──────────
-- We store a fixed known hash for "password" to avoid async hashing at seed time
-- Hash format: pbkdf2:iterations:salt:hash (verified in Worker)
INSERT OR IGNORE INTO users VALUES ('u1','admin@4syz.com','SEED:password','super_admin','Super Admin','4SYZ Platform','SA',1,datetime('now'));
INSERT OR IGNORE INTO users VALUES ('u2','ops@4syz.com','SEED:password','ops_admin','Arjun Mehta','4SYZ Platform','AM',1,datetime('now'));
INSERT OR IGNORE INTO users VALUES ('u3','procurement@4syz.com','SEED:password','procurement_manager','Priya Sharma','4SYZ Platform','PS',1,datetime('now'));
INSERT OR IGNORE INTO users VALUES ('u4','warehouse@4syz.com','SEED:password','warehouse_exec','Ravi Kumar','4SYZ Platform','RK',1,datetime('now'));
INSERT OR IGNORE INTO users VALUES ('u5','delivery.mgr@4syz.com','SEED:password','delivery_manager','Suresh Pillai','4SYZ Platform','SP',1,datetime('now'));
INSERT OR IGNORE INTO users VALUES ('u6','delivery@4syz.com','SEED:password','delivery_exec','Karan Singh','4SYZ Platform','KS',1,datetime('now'));
INSERT OR IGNORE INTO users VALUES ('u7','finance@4syz.com','SEED:password','finance_admin','Meena Iyer','4SYZ Platform','MI',1,datetime('now'));
INSERT OR IGNORE INTO users VALUES ('u8','client.admin@meta.com','SEED:password','client_admin','Rahul Verma','Meta India','RV',1,datetime('now'));
INSERT OR IGNORE INTO users VALUES ('u9','approver@meta.com','SEED:password','client_approver','Divya Nair','Meta India','DN',1,datetime('now'));
INSERT OR IGNORE INTO users VALUES ('u10','user@meta.com','SEED:password','client_user','Amit Patel','Meta India','AP',1,datetime('now'));
INSERT OR IGNORE INTO users VALUES ('u11','vendor.admin@freshfarms.com','SEED:password','vendor_admin','Sunita Reddy','Fresh Farms','SR',1,datetime('now'));
INSERT OR IGNORE INTO users VALUES ('u12','vendor@freshfarms.com','SEED:password','vendor_user','Mohan Das','Fresh Farms','MD',1,datetime('now'));

-- ── Seed: Clients ──────────────────────────────────────────────────
INSERT OR IGNORE INTO clients VALUES ('c1','Meta India','cafm@meta.com','Rahul Verma',88,800000,542000,100000,1,datetime('now'));
INSERT OR IGNORE INTO clients VALUES ('c2','LinkedIn India','admin@linkedin.com','Priti Shah',92,600000,310000,75000,1,datetime('now'));
INSERT OR IGNORE INTO clients VALUES ('c3','ServiceNow India','ops@servicenow.com','Anil Kumar',74,450000,398000,50000,1,datetime('now'));
INSERT OR IGNORE INTO clients VALUES ('c4','Sodexo Enterprise','procurement@sodexo.com','Maria D''Souza',95,1200000,720000,200000,1,datetime('now'));

-- ── Seed: Vendors ──────────────────────────────────────────────────
INSERT OR IGNORE INTO vendors VALUES ('v1','Fresh Farms Pvt Ltd','Beverages & Snacks','contact@freshfarms.com','+91-9876543210',94.0,97.0,2.1,4.8,1,datetime('now'));
INSERT OR IGNORE INTO vendors VALUES ('v2','Office Essentials Co','Office Supplies','sales@officeessentials.com','+91-9876543211',88.0,92.0,3.4,4.5,1,datetime('now'));
INSERT OR IGNORE INTO vendors VALUES ('v3','Brew Masters India','Beverages & Snacks','orders@brewmasters.com','+91-9876543212',79.0,85.0,4.2,3.9,1,datetime('now'));
INSERT OR IGNORE INTO vendors VALUES ('v4','CleanCo Supplies','Hygiene & Cleaning','supply@cleanco.com','+91-9876543213',96.0,99.0,1.8,4.9,1,datetime('now'));
INSERT OR IGNORE INTO vendors VALUES ('v5','TechFurn India','Office Furniture','info@techfurn.com','+91-9876543214',82.0,88.0,5.0,4.2,1,datetime('now'));

-- ── Seed: Inventory (12 SKUs) ──────────────────────────────────────
INSERT OR IGNORE INTO inventory VALUES ('SKU001','Premium Coffee Beans','Beverages',850,45,20,200,'v1','2101',18,'☕',1);
INSERT OR IGNORE INTO inventory VALUES ('SKU002','Green Tea Sachets','Beverages',320,128,50,500,'v1','2101',18,'🍵',1);
INSERT OR IGNORE INTO inventory VALUES ('SKU003','Assorted Biscuits Pack','Snacks',180,67,30,300,'v3','1905',12,'🍪',1);
INSERT OR IGNORE INTO inventory VALUES ('SKU004','Hand Sanitizer 500ml','Hygiene',220,34,40,400,'v4','3808',18,'🧴',1);
INSERT OR IGNORE INTO inventory VALUES ('SKU005','Tissue Box (100 pulls)','Hygiene',85,210,80,800,'v4','4818',12,'🧻',1);
INSERT OR IGNORE INTO inventory VALUES ('SKU006','Ballpoint Pens (Box 12)','Stationery',145,89,40,400,'v2','9608',18,'🖊️',1);
INSERT OR IGNORE INTO inventory VALUES ('SKU007','A4 Paper Ream (500 sheets)','Stationery',380,156,60,600,'v2','4802',12,'📄',1);
INSERT OR IGNORE INTO inventory VALUES ('SKU008','Mineral Water 1L (Case 24)','Beverages',480,92,50,500,'v1','2201',5,'💧',1);
INSERT OR IGNORE INTO inventory VALUES ('SKU009','Whiteboard Markers Set','Stationery',220,18,25,250,'v2','9608',18,'✏️',1);
INSERT OR IGNORE INTO inventory VALUES ('SKU010','Instant Noodles (Box 24)','Snacks',360,74,30,300,'v3','1902',12,'🍜',1);
INSERT OR IGNORE INTO inventory VALUES ('SKU011','Liquid Soap Dispenser','Hygiene',340,29,20,200,'v4','3401',18,'🫧',1);
INSERT OR IGNORE INTO inventory VALUES ('SKU012','Ergonomic Mouse Pad','Office',195,53,15,150,'v5','8473',18,'🖱️',1);

-- ── Seed: Orders ───────────────────────────────────────────────────
INSERT OR IGNORE INTO orders VALUES ('SP-2406-0891','c1','u10','IN_SHIPMENT',48600,8748,57348,'Urgent restocking',datetime('now','-2 days'),datetime('now','-1 day'));
INSERT OR IGNORE INTO orders VALUES ('SP-2406-0890','c2','u10','APPROVED',23400,4212,27612,'Monthly supplies',datetime('now','-3 days'),datetime('now','-2 days'));
INSERT OR IGNORE INTO orders VALUES ('SP-2406-0889','c3','u10','PENDING_APPROVAL',12800,2304,15104,NULL,datetime('now','-4 days'),datetime('now','-3 days'));
INSERT OR IGNORE INTO orders VALUES ('SP-2406-0888','c1','u10','VENDOR_PO_RAISED',67200,12096,79296,'Q2 bulk order',datetime('now','-5 days'),datetime('now','-4 days'));
INSERT OR IGNORE INTO orders VALUES ('SP-2406-0887','c4','u10','CLOSED',89400,16092,105492,NULL,datetime('now','-8 days'),datetime('now','-6 days'));
INSERT OR IGNORE INTO orders VALUES ('SP-2406-0886','c2','u10','ACKNOWLEDGED',34500,6210,40710,NULL,datetime('now','-6 days'),datetime('now','-5 days'));
INSERT OR IGNORE INTO orders VALUES ('SP-2406-0885','c3','u10','SUBMITTED',15600,2808,18408,NULL,datetime('now','-1 day'),datetime('now','-1 day'));
INSERT OR IGNORE INTO orders VALUES ('SP-2406-0884','c4','u10','CANCELLED',7200,1296,8496,NULL,datetime('now','-10 days'),datetime('now','-9 days'));

-- Order items
INSERT OR IGNORE INTO order_items VALUES ('oi1','SP-2406-0891','SKU001','Premium Coffee Beans',12,850,10200);
INSERT OR IGNORE INTO order_items VALUES ('oi2','SP-2406-0891','SKU008','Mineral Water 1L (Case 24)',20,480,9600);
INSERT OR IGNORE INTO order_items VALUES ('oi3','SP-2406-0891','SKU005','Tissue Box (100 pulls)',80,85,6800);
INSERT OR IGNORE INTO order_items VALUES ('oi4','SP-2406-0890','SKU006','Ballpoint Pens (Box 12)',30,145,4350);
INSERT OR IGNORE INTO order_items VALUES ('oi5','SP-2406-0890','SKU007','A4 Paper Ream',40,380,15200);
INSERT OR IGNORE INTO order_items VALUES ('oi6','SP-2406-0889','SKU003','Assorted Biscuits Pack',40,180,7200);
INSERT OR IGNORE INTO order_items VALUES ('oi7','SP-2406-0889','SKU004','Hand Sanitizer 500ml',25,220,5500);

-- Order history
INSERT OR IGNORE INTO order_history VALUES ('oh1','SP-2406-0891',NULL,'SUBMITTED','u10','Amit Patel',NULL,datetime('now','-2 days'));
INSERT OR IGNORE INTO order_history VALUES ('oh2','SP-2406-0891','SUBMITTED','APPROVED','u9','Divya Nair','Budget within threshold',datetime('now','-2 days','+2 hours'));
INSERT OR IGNORE INTO order_history VALUES ('oh3','SP-2406-0891','APPROVED','ACKNOWLEDGED','u2','Arjun Mehta',NULL,datetime('now','-1 day'));
INSERT OR IGNORE INTO order_history VALUES ('oh4','SP-2406-0891','ACKNOWLEDGED','VENDOR_PO_RAISED','u3','Priya Sharma',NULL,datetime('now','-1 day','+1 hour'));
INSERT OR IGNORE INTO order_history VALUES ('oh5','SP-2406-0891','VENDOR_PO_RAISED','IN_SHIPMENT','u11','Sunita Reddy','PO accepted, dispatched',datetime('now','-1 day','+3 hours'));

-- ── Seed: Purchase Orders ──────────────────────────────────────────
INSERT OR IGNORE INTO purchase_orders VALUES ('PO-0231','v1','SP-2406-0891','DISPATCHED',28000,5040,33040,date('now','+1 day'),NULL,NULL,datetime('now','-1 day'),datetime('now'));
INSERT OR IGNORE INTO purchase_orders VALUES ('PO-0232','v2','SP-2406-0890','ACCEPTED',19750,3555,23305,date('now','+2 days'),NULL,NULL,datetime('now','-2 days'),datetime('now','-1 day'));
INSERT OR IGNORE INTO purchase_orders VALUES ('PO-0233','v3','SP-2406-0889','SENT',12600,2268,14868,date('now','+3 days'),NULL,NULL,datetime('now','-1 day'),datetime('now','-1 day'));
INSERT OR IGNORE INTO purchase_orders VALUES ('PO-0234','v4','SP-2406-0888','SENT',34000,6120,40120,date('now','+4 days'),NULL,NULL,datetime('now','-3 days'),datetime('now','-3 days'));
INSERT OR IGNORE INTO purchase_orders VALUES ('PO-0230','v1','SP-2406-0887','INVOICED',89000,16020,105020,date('now','-2 days'),'Closed','https://example.com/inv/230.pdf',datetime('now','-7 days'),datetime('now','-5 days'));

-- ── Seed: Delivery Challans ────────────────────────────────────────
INSERT OR IGNORE INTO delivery_challans VALUES ('DC-1182','SP-2406-0887',NULL,'DELIVERED',datetime('now','-7 days'),datetime('now','-6 days'),0,NULL,'MH12-AB-1234','Rajesh Kumar','+91-9988776655');
INSERT OR IGNORE INTO delivery_challans VALUES ('DC-1183','SP-2406-0891',NULL,'IN_TRANSIT',datetime('now','-1 day'),NULL,0,NULL,'KA09-CD-5678','Suresh Bhat','+91-9988776656');
INSERT OR IGNORE INTO delivery_challans VALUES ('DC-1184','SP-2406-0890','PO-0232','DELIVERED',datetime('now','-3 days'),datetime('now','-2 days'),0,NULL,'TN07-EF-9012','Venkat Rao','+91-9988776657');
INSERT OR IGNORE INTO delivery_challans VALUES ('DC-1185','SP-2406-0886',NULL,'DELIVERED',datetime('now','-5 days'),datetime('now','-4 days'),0,NULL,'MH04-GH-3456','Arun Joshi','+91-9988776658');
INSERT OR IGNORE INTO delivery_challans VALUES ('DC-1186','SP-2406-0885',NULL,'SCHEDULED',datetime('now','+1 day'),NULL,0,NULL,NULL,NULL,NULL);

-- ── Seed: Tickets ──────────────────────────────────────────────────
INSERT OR IGNORE INTO tickets VALUES ('TKT-001','c1','u10','Coffee Machine Maintenance Request','Machine on floor 3 needs servicing','MEDIUM','OPEN',datetime('now','-2 days'),NULL);
INSERT OR IGNORE INTO tickets VALUES ('TKT-002','c2','u10','Wrong item delivered in last order','Received green tea instead of black tea bags','HIGH','IN_PROGRESS',datetime('now','-1 day'),NULL);
INSERT OR IGNORE INTO tickets VALUES ('TKT-003','c3','u10','Bulk order discount query','Need clarification on Q3 volume pricing','LOW','OPEN',datetime('now','-3 days'),NULL);
INSERT OR IGNORE INTO tickets VALUES ('TKT-004','c4','u10','Missing items in DC-1182','2 cartons of biscuits missing from delivery','HIGH','RESOLVED',datetime('now','-5 days'),datetime('now','-4 days'));
INSERT OR IGNORE INTO tickets VALUES ('TKT-005','c1','u10','Request for new vendor onboarding','Need organic snack vendor for Bangalore office','MEDIUM','OPEN',datetime('now','-1 day'),NULL);

-- ── Seed: Notifications ────────────────────────────────────────────
INSERT OR IGNORE INTO notifications VALUES ('n1',NULL,'New order SP-2406-0891 submitted by Meta Bangalore',0,datetime('now','-2 hours'));
INSERT OR IGNORE INTO notifications VALUES ('n2',NULL,'PO #PO-0231 dispatched by Fresh Farms — delivery confirmed',0,datetime('now','-18 hours'));
INSERT OR IGNORE INTO notifications VALUES ('n3',NULL,'Low stock alert: Whiteboard Markers Set (18 units remaining)',0,datetime('now','-1 day'));
INSERT OR IGNORE INTO notifications VALUES ('n4',NULL,'DC #DC-1182 pending billing — 6 days overdue',1,datetime('now','-3 days'));
