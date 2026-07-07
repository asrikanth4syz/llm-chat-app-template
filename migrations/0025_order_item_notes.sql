-- Migration 0025: Per-item remarks on orders (client can annotate each line item)
ALTER TABLE order_items ADD COLUMN item_note TEXT;
