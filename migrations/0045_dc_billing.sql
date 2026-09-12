-- Phase 2: DC billing — invoice number + date recorded when a DC is marked
-- billed. billed / billed_at already exist on delivery_challans.
ALTER TABLE delivery_challans ADD COLUMN invoice_no TEXT;
ALTER TABLE delivery_challans ADD COLUMN invoice_date TEXT;
