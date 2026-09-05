-- Zoho Inventory → App sync (milestone 002): provenance markers on inventory.
-- A SKU is "Zoho-originated" iff zoho_synced_at IS NOT NULL. Only Zoho-originated
-- SKUs are ever soft-deactivated by the nightly full reconcile; app-native / CSV
-- SKUs (zoho_synced_at IS NULL) are never touched by the sync. Additive, safe
-- defaults — merging changes nothing until an admin enables the sync.
ALTER TABLE inventory ADD COLUMN zoho_item_id TEXT;
ALTER TABLE inventory ADD COLUMN zoho_synced_at TEXT;
