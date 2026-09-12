-- Phase 1: challan-first (ad-hoc) DCs — a Delivery Challan created directly,
-- with no order behind it, drawing its number from the FY series (dc_series).
-- order_id stays NOT NULL in the base schema, so ad-hoc rows use order_id=''.
ALTER TABLE delivery_challans ADD COLUMN ad_hoc INTEGER DEFAULT 0;
ALTER TABLE delivery_challans ADD COLUMN dc_class TEXT;      -- CONSUMABLE | GIFTING
ALTER TABLE delivery_challans ADD COLUMN category TEXT;      -- Consumables | Gifting | Returnable-Sample | Non-Returnable
ALTER TABLE delivery_challans ADD COLUMN client_name TEXT;
ALTER TABLE delivery_challans ADD COLUMN items_text TEXT;
ALTER TABLE delivery_challans ADD COLUMN notes TEXT;
