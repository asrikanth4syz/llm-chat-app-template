-- Standardise HSN codes to 6 digits (GST requires 6-digit HSN for most B2B).
-- 1) Replace the 4-digit starter rows in hsn_gst_rates with their 6-digit
--    subheadings (same GST slab). 2) Remap existing inventory items that used one
--    of those exact 4-digit codes. 3) Retire the old 4-digit '2101' default marker.
-- The 8→6→4→2 lookup fallback still resolves any 8-digit item code to its parent.
-- NOTE: these are representative 6-digit codes — verify against your authoritative
-- GST HSN list and adjust via Settings → HSN → GST if a subheading differs.

-- 1) Insert 6-digit rows (idempotent).
INSERT OR IGNORE INTO hsn_gst_rates (hsn,gst_rate,description) VALUES
  ('040120', 0,  'Milk, fresh'),
  ('040210', 5,  'Milk powder / concentrated milk'),
  ('090121', 5,  'Coffee, roasted'),
  ('090230', 5,  'Tea, black (fermented)'),
  ('170199', 5,  'Sugar'),
  ('170490',18,  'Sugar confectionery'),
  ('180690',18,  'Chocolate & cocoa preparations'),
  ('190590',18,  'Biscuits, bread, cakes'),
  ('200989',12,  'Fruit & vegetable juices'),
  ('210690',12,  'Food preparations n.e.s. (namkeen/snacks)'),
  ('220110',18,  'Water, incl. mineral (unsweetened)'),
  ('220210',28,  'Aerated / sweetened / flavoured beverages'),
  ('340111',18,  'Soap (toilet/bar)'),
  ('340220',18,  'Detergents & cleaning preparations'),
  ('380894',18,  'Disinfectants / sanitizers'),
  ('392410',18,  'Plastic tableware / kitchenware'),
  ('480257',12,  'Paper'),
  ('481710',18,  'Envelopes'),
  ('482020',12,  'Registers, notebooks, exercise books'),
  ('482369',18,  'Paper articles (napkins, tissues)'),
  ('960810',18,  'Pens (ball point)');

-- 2) Remap inventory items carrying an old 4-digit starter code to the 6-digit one.
UPDATE inventory SET hsn_code='040120' WHERE hsn_code='0401';
UPDATE inventory SET hsn_code='040210' WHERE hsn_code='0402';
UPDATE inventory SET hsn_code='090121' WHERE hsn_code='0901';
UPDATE inventory SET hsn_code='090230' WHERE hsn_code='0902';
UPDATE inventory SET hsn_code='170199' WHERE hsn_code='1701';
UPDATE inventory SET hsn_code='170490' WHERE hsn_code='1704';
UPDATE inventory SET hsn_code='180690' WHERE hsn_code='1806';
UPDATE inventory SET hsn_code='190590' WHERE hsn_code='1905';
UPDATE inventory SET hsn_code='200989' WHERE hsn_code='2009';
UPDATE inventory SET hsn_code='210690' WHERE hsn_code='2106';
UPDATE inventory SET hsn_code='220110' WHERE hsn_code='2201';
UPDATE inventory SET hsn_code='220210' WHERE hsn_code='2202';
UPDATE inventory SET hsn_code='340111' WHERE hsn_code='3401';
UPDATE inventory SET hsn_code='340220' WHERE hsn_code='3402';
UPDATE inventory SET hsn_code='380894' WHERE hsn_code='3808';
UPDATE inventory SET hsn_code='392410' WHERE hsn_code='3924';
UPDATE inventory SET hsn_code='480257' WHERE hsn_code='4802';
UPDATE inventory SET hsn_code='481710' WHERE hsn_code='4817';
UPDATE inventory SET hsn_code='482020' WHERE hsn_code='4820';
UPDATE inventory SET hsn_code='482369' WHERE hsn_code='4823';
UPDATE inventory SET hsn_code='960810' WHERE hsn_code='9608';

-- 3) Retire the old 4-digit default marker (never a real classification).
UPDATE inventory SET hsn_code='' WHERE hsn_code='2101';

-- 4) Drop the 4-digit starter rows now superseded by the 6-digit ones.
DELETE FROM hsn_gst_rates WHERE hsn IN
  ('0401','0402','0901','0902','1701','1704','1806','1905','2009','2106',
   '2201','2202','3401','3402','3808','3924','4802','4817','4820','4823','9608');
