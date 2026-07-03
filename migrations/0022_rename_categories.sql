-- Migration 0022: Rename category display names for consistency
UPDATE inventory       SET category = 'Beverages'  WHERE category = 'Beverage';
UPDATE inventory       SET category = 'Snacks'      WHERE category = 'Snack';
UPDATE inventory       SET category = 'Stationary'  WHERE category = 'Stationery';
UPDATE inventory       SET category = 'DryFruits'   WHERE category = 'DryFruit';

UPDATE client_inventory SET category = 'Beverages'  WHERE category = 'Beverage';
UPDATE client_inventory SET category = 'Snacks'      WHERE category = 'Snack';
UPDATE client_inventory SET category = 'Stationary'  WHERE category = 'Stationery';
UPDATE client_inventory SET category = 'DryFruits'   WHERE category = 'DryFruit';

UPDATE order_items     SET category = 'Beverages'  WHERE category = 'Beverage';
UPDATE order_items     SET category = 'Snacks'      WHERE category = 'Snack';
UPDATE order_items     SET category = 'Stationary'  WHERE category = 'Stationery';
UPDATE order_items     SET category = 'DryFruits'   WHERE category = 'DryFruit';
