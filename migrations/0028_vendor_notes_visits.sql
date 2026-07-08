-- Migration 0028: Vendor comments, lead time already exists; add visit schedule
ALTER TABLE vendors ADD COLUMN notes TEXT;
ALTER TABLE vendors ADD COLUMN visit_frequency TEXT;   -- Weekly / Fortnightly / Monthly / On-Demand
ALTER TABLE vendors ADD COLUMN visit_day TEXT;         -- e.g. Monday, or day-of-month like 15
