-- Migration 0014: Address + map pin for clients and vendors
ALTER TABLE clients ADD COLUMN address TEXT DEFAULT '';
ALTER TABLE vendors ADD COLUMN address TEXT DEFAULT '';
ALTER TABLE vendors ADD COLUMN map_pin TEXT DEFAULT '';
