-- Migration 0010: Add sub_category field to inventory

ALTER TABLE inventory ADD COLUMN sub_category TEXT DEFAULT 'Normal';
