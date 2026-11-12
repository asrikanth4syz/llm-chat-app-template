-- Zoho Delivery Challans: per-row detail flag. detail_ok=1 means the challan's
-- line count, quantity and invoice numbers have been pulled from its Zoho detail
-- record. The sync only fetches detail for rows where detail_ok=0, so repeated
-- runs converge to full coverage instead of re-zeroing already-fetched rows, and
-- COUNT(detail_ok=0) is the "still pending" completeness signal for the register.
ALTER TABLE zoho_delivery_challans ADD COLUMN detail_ok INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_zdc_detail ON zoho_delivery_challans(detail_ok);
