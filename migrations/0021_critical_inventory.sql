-- Migration 0021: Critical flag for inventory items
ALTER TABLE inventory ADD COLUMN is_critical INTEGER DEFAULT 0;
