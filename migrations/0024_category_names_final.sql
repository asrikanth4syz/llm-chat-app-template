-- Migration 0024: Final authoritative category name fixes
-- Covers both original values and any intermediate values from prior migrations

UPDATE inventory        SET category = 'Beverages'  WHERE category IN ('Beverage');
UPDATE inventory        SET category = 'Snacks'      WHERE category IN ('Snack');
UPDATE inventory        SET category = 'Stationery'  WHERE category IN ('Stationary');
UPDATE inventory        SET category = 'DryFruits'   WHERE category IN ('DryFruit');

UPDATE client_inventory SET category = 'Beverages'  WHERE category IN ('Beverage');
UPDATE client_inventory SET category = 'Snacks'      WHERE category IN ('Snack');
UPDATE client_inventory SET category = 'Stationery'  WHERE category IN ('Stationary');
UPDATE client_inventory SET category = 'DryFruits'   WHERE category IN ('DryFruit');

UPDATE order_items      SET category = 'Beverages'  WHERE category IN ('Beverage');
UPDATE order_items      SET category = 'Snacks'      WHERE category IN ('Snack');
UPDATE order_items      SET category = 'Stationery'  WHERE category IN ('Stationary');
UPDATE order_items      SET category = 'DryFruits'   WHERE category IN ('DryFruit');
