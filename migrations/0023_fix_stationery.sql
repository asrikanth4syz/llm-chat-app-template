-- Migration 0023: Correct spelling Stationary → Stationery
UPDATE inventory        SET category = 'Stationery' WHERE category = 'Stationary';
UPDATE client_inventory SET category = 'Stationery' WHERE category = 'Stationary';
UPDATE order_items      SET category = 'Stationery' WHERE category = 'Stationary';
