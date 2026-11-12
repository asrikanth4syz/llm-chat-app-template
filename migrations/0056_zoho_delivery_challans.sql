-- Zoho Inventory Delivery Challans — read-only finance register (Billing & Finance).
-- A bounded mirror of Zoho's Delivery Challans so Finance can see, per customer and
-- per month, each DC's number, date, billed-to, line count, quantity count, invoiced
-- state and the linked invoice number(s). Header fields come from the DC list. Line
-- count / qty come from the per-DC detail. Invoice numbers come from the DC's linked
-- invoices (one-to-many). Additive and safe: the sync is manual and writes ONLY to
-- this table, never inventory, orders or the app's own delivery challans.
CREATE TABLE IF NOT EXISTS zoho_delivery_challans (
  zoho_dc_id       TEXT PRIMARY KEY,   -- Zoho deliverychallan_id
  dc_number        TEXT,               -- deliverychallan_number (e.g. DC-00051)
  dc_date          TEXT,               -- date (YYYY-MM-DD)
  ym               TEXT,               -- YYYY-MM derived from dc_date (month filter)
  customer_id      TEXT,               -- Zoho customer_id ("DC for")
  customer_name    TEXT,               -- billed-to name
  line_count       INTEGER DEFAULT 0,  -- number of line items (from detail)
  qty_count        REAL    DEFAULT 0,  -- summed line quantity (from detail)
  invoiced_status  TEXT,               -- invoiced / partially_invoiced / not_invoiced
  invoice_numbers  TEXT    DEFAULT '[]', -- JSON array of linked invoice numbers
  total            REAL    DEFAULT 0,  -- DC total
  currency_code    TEXT,
  zoho_modified    TEXT,               -- Zoho last_modified_time (provenance)
  synced_at        TEXT                -- when this row was last pulled
);
CREATE INDEX IF NOT EXISTS idx_zdc_ym       ON zoho_delivery_challans(ym);
CREATE INDEX IF NOT EXISTS idx_zdc_customer ON zoho_delivery_challans(customer_id);
