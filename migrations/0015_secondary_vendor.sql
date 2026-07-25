-- Migration 0015: Secondary vendor on inventory items
ALTER TABLE inventory ADD COLUMN secondary_vendor_id TEXT DEFAULT NULL;
