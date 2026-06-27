-- Migration 0013: Add location field to vendors
ALTER TABLE vendors ADD COLUMN location TEXT DEFAULT '';
