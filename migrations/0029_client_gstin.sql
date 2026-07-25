-- Migration 0029: optional tax identifiers on clients.
-- GSTIN: a valid 15-char GST number. PAN: 10-char (5 letters, 4 digits, 1 letter).
-- The GSTIN embeds the PAN at characters 3-12; validated/reconciled in the API and UI.
ALTER TABLE clients ADD COLUMN gstin TEXT;
ALTER TABLE clients ADD COLUMN pan TEXT;
