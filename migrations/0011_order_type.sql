-- Migration 0011: Order Type field
ALTER TABLE orders ADD COLUMN order_type TEXT NOT NULL DEFAULT 'Regular';
