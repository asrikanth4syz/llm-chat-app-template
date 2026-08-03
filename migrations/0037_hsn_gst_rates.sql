-- HSN → GST slab mapping so a product's GST (0/5/12/18/28%) comes from its HSN
-- code, not a flat 18% default. Keyed by HSN (full or heading prefix — the
-- lookup falls back 8→6→4→2 digits). STARTER values for common FMCG headings —
-- review/replace with your authoritative list (bulk upsert via /api/hsn-gst-rates).
CREATE TABLE IF NOT EXISTS hsn_gst_rates (
  hsn         TEXT PRIMARY KEY,
  gst_rate    REAL NOT NULL,
  description TEXT,
  updated_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT
);

INSERT OR IGNORE INTO hsn_gst_rates (hsn,gst_rate,description) VALUES
  ('0401', 0,  'Milk, fresh'),
  ('0402', 5,  'Milk powder / concentrated milk'),
  ('0901', 5,  'Coffee'),
  ('0902', 5,  'Tea'),
  ('1701', 5,  'Sugar'),
  ('1704',18,  'Sugar confectionery'),
  ('1806',18,  'Chocolate & cocoa preparations'),
  ('1905',18,  'Biscuits, bread, cakes'),
  ('2009',12,  'Fruit & vegetable juices'),
  ('2106',12,  'Food preparations n.e.s. (namkeen/snacks)'),
  ('2201',18,  'Water, incl. mineral (unsweetened)'),
  ('2202',28,  'Aerated / sweetened / flavoured beverages'),
  ('3401',18,  'Soap'),
  ('3402',18,  'Detergents & cleaning preparations'),
  ('3808',18,  'Disinfectants / sanitizers'),
  ('3924',18,  'Plastic tableware / kitchenware'),
  ('4802',12,  'Paper'),
  ('4817',18,  'Envelopes'),
  ('4820',12,  'Registers, notebooks, exercise books'),
  ('4823',18,  'Paper articles (napkins, tissues)'),
  ('9608',18,  'Pens');
