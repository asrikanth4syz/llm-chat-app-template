-- Gifting fork (milestone 007): an order carries the fulfilment kind
-- (REGULAR | GIFTING) copied from its source quote at convert time. A GIFTING
-- order runs the distinct gifting workflow and is listed in its own pipeline,
-- excluded from the regular orders list. ensureQuoteSchema self-heals the same
-- column for live DBs; this migration keeps migration-built DBs (and tests) in parity.
ALTER TABLE orders ADD COLUMN order_kind TEXT DEFAULT 'REGULAR';
