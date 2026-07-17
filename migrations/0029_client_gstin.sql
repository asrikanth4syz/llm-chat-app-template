-- Migration 0029: optional GST registration number (GSTIN) on clients.
-- 15 letters/digits when present; validated in the API and UI.
ALTER TABLE clients ADD COLUMN gstin TEXT;
