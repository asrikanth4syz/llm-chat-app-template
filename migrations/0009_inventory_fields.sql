-- Migration 0009: Extended inventory fields for UOM, packing, and vendor details

ALTER TABLE inventory ADD COLUMN uom TEXT DEFAULT 'unit';
ALTER TABLE inventory ADD COLUMN pack_size INTEGER DEFAULT 1;
ALTER TABLE inventory ADD COLUMN units_per_case INTEGER DEFAULT 1;
ALTER TABLE inventory ADD COLUMN weight_grams REAL DEFAULT 0;
ALTER TABLE inventory ADD COLUMN barcode TEXT DEFAULT '';
ALTER TABLE inventory ADD COLUMN batch_no TEXT DEFAULT '';
ALTER TABLE inventory ADD COLUMN vendor_sku TEXT DEFAULT '';
ALTER TABLE inventory ADD COLUMN vendor_lead_days INTEGER DEFAULT 3;
ALTER TABLE inventory ADD COLUMN vendor_moq INTEGER DEFAULT 1;
