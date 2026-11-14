-- FR-01 Profile enhancement: a profile photo, stored as a small data URL (the app
-- downscales to ~256px before upload). Non-confidential, so it may appear in the
-- directory. NULL means "use initials".
ALTER TABLE employees ADD COLUMN photo TEXT;
