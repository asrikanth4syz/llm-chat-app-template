-- Migration 0030: vendor registration & food-safety compliance.
-- registration_type: 'registered' | 'unregistered' (registered ⇒ GSTIN + PAN).
-- vendor_type: 'food' | 'non_food' (food ⇒ FSSAI licence + expiry).
ALTER TABLE vendors ADD COLUMN registration_type TEXT DEFAULT 'unregistered';
ALTER TABLE vendors ADD COLUMN gstin TEXT;
ALTER TABLE vendors ADD COLUMN pan TEXT;
ALTER TABLE vendors ADD COLUMN vendor_type TEXT DEFAULT 'non_food';
ALTER TABLE vendors ADD COLUMN fssai_licence TEXT;
ALTER TABLE vendors ADD COLUMN fssai_expiry TEXT;
