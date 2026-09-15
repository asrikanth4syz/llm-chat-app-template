-- GST return filing frequency for a vendor (Monthly / Quarterly), shown on the
-- vendor's GST/compliance details.
ALTER TABLE vendors ADD COLUMN gst_filing_frequency TEXT;
