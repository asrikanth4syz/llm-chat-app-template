-- Migration 0012: Need By Date + Predicted Delivery Date on orders
ALTER TABLE orders ADD COLUMN need_by_date TEXT;
ALTER TABLE orders ADD COLUMN predicted_delivery_date TEXT;
