-- Product Intelligence & Brand Catalogue (P0.0)
-- Rich product facts + AI-assisted claim extraction/screening + human verification.
-- Production self-heals these via ensureFeatureTables(); this file mirrors the DDL
-- so the vitest test DB has the same shape. All statements are idempotent.

CREATE TABLE IF NOT EXISTS brands ( id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT, logo_doc_id TEXT, story TEXT, origin TEXT, website TEXT, brand_type TEXT, status TEXT NOT NULL DEFAULT 'draft', sla_json TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS product_content ( sku TEXT PRIMARY KEY, description TEXT, usage TEXT, images_json TEXT DEFAULT '[]', updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS product_nutrition ( sku TEXT PRIMARY KEY, basis TEXT DEFAULT 'per 100g', calories REAL, protein REAL, carbs REAL, sugar REAL, fat REAL, fibre REAL, sodium REAL, source_ref TEXT, updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS product_ingredients ( id TEXT PRIMARY KEY, sku TEXT NOT NULL, position INTEGER DEFAULT 0, raw_text TEXT NOT NULL, normalized_id TEXT, grp TEXT, allergen INTEGER DEFAULT 0, flags_json TEXT DEFAULT '[]' );
CREATE TABLE IF NOT EXISTS ingredient_dict ( id TEXT PRIMARY KEY, canonical_name TEXT NOT NULL, synonyms_json TEXT DEFAULT '[]', allergen INTEGER DEFAULT 0, animal_derived INTEGER DEFAULT 0, category TEXT );
CREATE TABLE IF NOT EXISTS product_attributes ( id TEXT PRIMARY KEY, sku TEXT NOT NULL, attribute TEXT NOT NULL, value TEXT DEFAULT 'true', status TEXT NOT NULL DEFAULT 'ai_extracted', source TEXT, updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS claims ( id TEXT PRIMARY KEY, sku TEXT NOT NULL, category TEXT NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ai_extracted', ai_confidence REAL, screened_result TEXT, reviewer_id TEXT, reviewer_name TEXT, reviewed_at TEXT, expiry_date TEXT, created_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS claim_evidence ( id TEXT PRIMARY KEY, claim_id TEXT NOT NULL, doc_id TEXT, page_ref TEXT, extracted_text TEXT, extraction_date TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS claim_history ( id TEXT PRIMARY KEY, claim_id TEXT NOT NULL, action TEXT NOT NULL, actor_id TEXT, actor_name TEXT, from_status TEXT, to_status TEXT, note TEXT, created_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS certifications ( id TEXT PRIMARY KEY, scope TEXT NOT NULL DEFAULT 'product', brand_id TEXT, sku TEXT, kind TEXT NOT NULL, number TEXT, issuer TEXT, valid_from TEXT, valid_to TEXT, doc_id TEXT, status TEXT NOT NULL DEFAULT 'unverified', created_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS collections ( id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT, kind TEXT NOT NULL DEFAULT 'rule', rule_json TEXT, curated_by TEXT, published INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS collection_items ( collection_id TEXT NOT NULL, sku TEXT NOT NULL, pinned INTEGER DEFAULT 0, excluded INTEGER DEFAULT 0, PRIMARY KEY (collection_id, sku) );
CREATE TABLE IF NOT EXISTS verification_tasks ( id TEXT PRIMARY KEY, task_type TEXT NOT NULL DEFAULT 'claim', sku TEXT, claim_id TEXT, priority TEXT DEFAULT 'normal', status TEXT NOT NULL DEFAULT 'open', assignee_id TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS client_favourites ( client_id TEXT NOT NULL, sku TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (client_id, sku) );
CREATE TABLE IF NOT EXISTS saved_filters ( id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, query_json TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS pi_rule_dict ( id TEXT PRIMARY KEY, dict TEXT NOT NULL, term TEXT NOT NULL, meta_json TEXT, active INTEGER DEFAULT 1 );

ALTER TABLE inventory ADD COLUMN brand_id TEXT;
ALTER TABLE inventory ADD COLUMN product_type TEXT;
ALTER TABLE inventory ADD COLUMN barcode_gtin TEXT;
ALTER TABLE inventory ADD COLUMN pack_size TEXT;
ALTER TABLE inventory ADD COLUMN units_per_carton INTEGER;
ALTER TABLE inventory ADD COLUMN moq INTEGER;
ALTER TABLE inventory ADD COLUMN case_config TEXT;
ALTER TABLE inventory ADD COLUMN serving_info TEXT;
ALTER TABLE inventory ADD COLUMN storage_info TEXT;
ALTER TABLE inventory ADD COLUMN lifecycle_status TEXT DEFAULT 'draft';

-- Seed editable claim-screening dictionaries (idempotent).
INSERT OR IGNORE INTO pi_rule_dict (id,dict,term,active) VALUES ('animal_derived:milk','animal_derived','milk',1);
INSERT OR IGNORE INTO pi_rule_dict (id,dict,term,active) VALUES ('animal_derived:milk solids','animal_derived','milk solids',1);
INSERT OR IGNORE INTO pi_rule_dict (id,dict,term,active) VALUES ('animal_derived:whey','animal_derived','whey',1);
INSERT OR IGNORE INTO pi_rule_dict (id,dict,term,active) VALUES ('animal_derived:casein','animal_derived','casein',1);
INSERT OR IGNORE INTO pi_rule_dict (id,dict,term,active) VALUES ('animal_derived:egg','animal_derived','egg',1);
INSERT OR IGNORE INTO pi_rule_dict (id,dict,term,active) VALUES ('animal_derived:albumin','animal_derived','albumin',1);
INSERT OR IGNORE INTO pi_rule_dict (id,dict,term,active) VALUES ('animal_derived:honey','animal_derived','honey',1);
INSERT OR IGNORE INTO pi_rule_dict (id,dict,term,active) VALUES ('animal_derived:gelatin','animal_derived','gelatin',1);
INSERT OR IGNORE INTO pi_rule_dict (id,dict,term,active) VALUES ('preservative:sodium benzoate','preservative','sodium benzoate',1);
INSERT OR IGNORE INTO pi_rule_dict (id,dict,term,active) VALUES ('preservative:potassium sorbate','preservative','potassium sorbate',1);
INSERT OR IGNORE INTO pi_rule_dict (id,dict,term,active) VALUES ('sweetener:sugar','sweetener','sugar',1);
INSERT OR IGNORE INTO pi_rule_dict (id,dict,term,active) VALUES ('sweetener:glucose syrup','sweetener','glucose syrup',1);
