-- Human-readable vendor code (VDR-YYYY-NNNNN).
-- The running number is generated and backfilled at runtime by fixCategoryNames()
-- (see src/index.ts): globally sequential so codes stay unique across years.
ALTER TABLE vendors ADD COLUMN vendor_code TEXT;
