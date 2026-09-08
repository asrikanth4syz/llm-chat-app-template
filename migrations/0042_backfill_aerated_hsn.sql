-- GST 2.0: the 28→40 reconciliation moves aerated/sugary drinks to the 40% demerit
-- slab, but many were never tagged with an HSN, so GST showed without a matching HSN
-- code. In this catalogue 40% only ever applies to aerated beverages, whose canonical
-- GST 2.0 heading is 220210 — stamp it onto any 40% item still missing an HSN so GST
-- and HSN both trace to the same GST 2.0 row. Only fills a blank code, so an admin's
-- explicit HSN is never overwritten (one-time; the migration runs once).
UPDATE inventory SET hsn_code = '220210' WHERE gst_rate = 40 AND (hsn_code IS NULL OR hsn_code = '');
