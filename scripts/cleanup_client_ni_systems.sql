-- ============================================================================
-- ONE-OFF ORDER CLEANUP — NI Systems (India) Pvt Ltd (TEST DATA).
-- Deletes every order for this client and all related transaction rows.
--
-- ⚠️  IRREVERSIBLE. Preview + back up first:
--     npx wrangler d1 execute smart-pantry-db --remote --file scripts/cleanup_client_ni_systems_preview.sql
--     npx wrangler d1 export  smart-pantry-db --remote --output backup_before_ni_cleanup.sql
--
-- Run (production D1):
--     npx wrangler d1 execute smart-pantry-db --remote --file scripts/cleanup_client_ni_systems.sql
--   (drop --remote to rehearse against the local dev DB first)
--
-- NOT a migration — lives in scripts/ so it never auto-runs on deploy.
-- Scoped entirely by the client name; the client row itself is KEPT (only its
-- orders and their transactions are removed). Orders are deleted LAST so every
-- subquery below stays valid throughout.
--
-- Vendor POs raised from these orders are also removed, including their newer
-- children (grn_lines, inventory_batches, po_invoices, vendor_debit_notes) —
-- requires migrations >= 0036 to be applied in production (they will be after
-- this branch deploys). If a table does not exist yet, apply migrations first.
-- ============================================================================

-- 1) Vendor-PO children of POs linked to these orders (delete before the POs) --
DELETE FROM inventory_batches WHERE grn_line_id IN (SELECT id FROM grn_lines WHERE grn_id IN (SELECT id FROM grn_records WHERE po_id IN (SELECT id FROM purchase_orders WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd')))));
DELETE FROM grn_lines         WHERE grn_id IN (SELECT id FROM grn_records WHERE po_id IN (SELECT id FROM purchase_orders WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd'))));
DELETE FROM po_invoices       WHERE po_id IN (SELECT id FROM purchase_orders WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd')));
DELETE FROM vendor_debit_notes WHERE po_id IN (SELECT id FROM purchase_orders WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd')));
DELETE FROM grn_records       WHERE po_id IN (SELECT id FROM purchase_orders WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd')));
DELETE FROM vendor_feedback   WHERE po_id IN (SELECT id FROM purchase_orders WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd')));
DELETE FROM po_items          WHERE po_id IN (SELECT id FROM purchase_orders WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd')));
DELETE FROM purchase_orders   WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd'));

-- 2) Delivery-challan children, then the challans themselves ------------------
DELETE FROM dc_items          WHERE dc_id IN (SELECT id FROM delivery_challans WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd')));
DELETE FROM dc_documents      WHERE dc_id IN (SELECT id FROM delivery_challans WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd')));
DELETE FROM delivery_returns  WHERE dc_id IN (SELECT id FROM delivery_challans WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd')));
DELETE FROM returns           WHERE dc_id IN (SELECT id FROM delivery_challans WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd')));
DELETE FROM delivery_challans WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd'));

-- 3) Order-linked workflow rows ----------------------------------------------
DELETE FROM returns               WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd'));
DELETE FROM order_items           WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd'));
DELETE FROM order_history         WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd'));
DELETE FROM order_comments        WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd'));
DELETE FROM order_allocations     WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd'));
DELETE FROM dunning_events        WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd'));
DELETE FROM standing_order_events WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd'));

-- 4) The orders themselves (last) --------------------------------------------
DELETE FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd');
