-- ============================================================================
-- One-off ORDER CLEANUP — deletes 8 orders and all their workflow rows.
--
-- ⚠️  IRREVERSIBLE. Take a backup first:
--     npx wrangler d1 export smart-pantry-db --remote --output backup_before_cleanup.sql
--
-- Run (production D1):
--     npx wrangler d1 execute smart-pantry-db --remote --file scripts/cleanup_orders.sql
--   (drop --remote to run against the local dev DB first as a rehearsal)
--
-- This is NOT a migration — it lives in scripts/ so it never auto-runs on deploy.
--
-- Orders removed:
--   SP-2607-3170, SP-2606-3795, SP-2606-5234, SP-2606-5603,
--   SP-2606-3464, SP-2606-6069, SP-2406-0891, SP-2406-0888
--
-- Child rows removed (per order): order_items, order_history, order_comments,
--   order_allocations, dunning_events, standing_order_events, delivery_challans
--   and their dc_items / dc_documents / delivery_returns / returns.
-- Vendor purchase orders raised from these orders are DELETED along with their
--   po_items / grn_records / per-PO dunning_events (these are test orders).
-- ============================================================================

-- 1) Delivery-challan children (delete BEFORE the challans they belong to) ----
DELETE FROM dc_items        WHERE dc_id IN (SELECT id FROM delivery_challans WHERE order_id IN
  ('SP-2607-3170','SP-2606-3795','SP-2606-5234','SP-2606-5603','SP-2606-3464','SP-2606-6069','SP-2406-0891','SP-2406-0888'));
DELETE FROM dc_documents    WHERE dc_id IN (SELECT id FROM delivery_challans WHERE order_id IN
  ('SP-2607-3170','SP-2606-3795','SP-2606-5234','SP-2606-5603','SP-2606-3464','SP-2606-6069','SP-2406-0891','SP-2406-0888'));
DELETE FROM delivery_returns WHERE dc_id IN (SELECT id FROM delivery_challans WHERE order_id IN
  ('SP-2607-3170','SP-2606-3795','SP-2606-5234','SP-2606-5603','SP-2606-3464','SP-2606-6069','SP-2406-0891','SP-2406-0888'));
DELETE FROM returns         WHERE dc_id IN (SELECT id FROM delivery_challans WHERE order_id IN
  ('SP-2607-3170','SP-2606-3795','SP-2606-5234','SP-2606-5603','SP-2606-3464','SP-2606-6069','SP-2406-0891','SP-2406-0888'));

-- 2) Delivery challans themselves --------------------------------------------
DELETE FROM delivery_challans WHERE order_id IN
  ('SP-2607-3170','SP-2606-3795','SP-2606-5234','SP-2606-5603','SP-2606-3464','SP-2606-6069','SP-2406-0891','SP-2406-0888');

-- 3) Any remaining order-linked rows -----------------------------------------
DELETE FROM returns               WHERE order_id IN
  ('SP-2607-3170','SP-2606-3795','SP-2606-5234','SP-2606-5603','SP-2606-3464','SP-2606-6069','SP-2406-0891','SP-2406-0888');
DELETE FROM order_items           WHERE order_id IN
  ('SP-2607-3170','SP-2606-3795','SP-2606-5234','SP-2606-5603','SP-2606-3464','SP-2606-6069','SP-2406-0891','SP-2406-0888');
DELETE FROM order_history         WHERE order_id IN
  ('SP-2607-3170','SP-2606-3795','SP-2606-5234','SP-2606-5603','SP-2606-3464','SP-2606-6069','SP-2406-0891','SP-2406-0888');
DELETE FROM order_comments        WHERE order_id IN
  ('SP-2607-3170','SP-2606-3795','SP-2606-5234','SP-2606-5603','SP-2606-3464','SP-2606-6069','SP-2406-0891','SP-2406-0888');
DELETE FROM order_allocations     WHERE order_id IN
  ('SP-2607-3170','SP-2606-3795','SP-2606-5234','SP-2606-5603','SP-2606-3464','SP-2606-6069','SP-2406-0891','SP-2406-0888');
DELETE FROM dunning_events        WHERE order_id IN
  ('SP-2607-3170','SP-2606-3795','SP-2606-5234','SP-2606-5603','SP-2606-3464','SP-2606-6069','SP-2406-0891','SP-2406-0888');
DELETE FROM standing_order_events WHERE order_id IN
  ('SP-2607-3170','SP-2606-3795','SP-2606-5234','SP-2606-5603','SP-2606-3464','SP-2606-6069','SP-2406-0891','SP-2406-0888');

-- 4) Vendor POs raised from these orders + their children (delete) ------------
DELETE FROM po_items       WHERE po_id IN (SELECT id FROM purchase_orders WHERE order_id IN
  ('SP-2607-3170','SP-2606-3795','SP-2606-5234','SP-2606-5603','SP-2606-3464','SP-2606-6069','SP-2406-0891','SP-2406-0888'));
DELETE FROM grn_records    WHERE po_id IN (SELECT id FROM purchase_orders WHERE order_id IN
  ('SP-2607-3170','SP-2606-3795','SP-2606-5234','SP-2606-5603','SP-2606-3464','SP-2606-6069','SP-2406-0891','SP-2406-0888'));
DELETE FROM vendor_feedback WHERE po_id IN (SELECT id FROM purchase_orders WHERE order_id IN
  ('SP-2607-3170','SP-2606-3795','SP-2606-5234','SP-2606-5603','SP-2606-3464','SP-2606-6069','SP-2406-0891','SP-2406-0888'));
DELETE FROM purchase_orders WHERE order_id IN
  ('SP-2607-3170','SP-2606-3795','SP-2606-5234','SP-2606-5603','SP-2606-3464','SP-2606-6069','SP-2406-0891','SP-2406-0888');

-- 5) The orders themselves ----------------------------------------------------
DELETE FROM orders WHERE id IN
  ('SP-2607-3170','SP-2606-3795','SP-2606-5234','SP-2606-5603','SP-2606-3464','SP-2606-6069','SP-2406-0891','SP-2406-0888');
