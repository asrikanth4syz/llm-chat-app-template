-- Resignation-date mode default flipped to ON (today/future): employees pick today or a later
-- date; dates before today are greyed/disabled. Past-only (OFF) remains available via the admin
-- "Resignation date policy" toggle. 0026 seeded '0' (OFF); this sets the stored default to '1'.
UPDATE portal_config SET value = '1' WHERE key = 'resign_allow_future';
