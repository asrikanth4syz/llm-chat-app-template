-- ============================================================================
-- READ-ONLY diagnostic: why are 1,659 SKUs "below reorder level"?
-- Decomposes the count so you can tell real scarcity from a config artifact.
--   npx wrangler d1 execute smart-pantry-db --remote --file scripts/diagnose_reorder.sql
-- Deletes/changes nothing.
-- ============================================================================

-- 1) The headline breakdown -------------------------------------------------
--   below_reorder            = the "1659" (stock <= reorder_level)
--   zero_stock_zero_reorder  = 0 stock AND 0 reorder → counted only because 0<=0
--                              (dead/unstocked catalogue rows — ARTIFACT)
--   low_but_stocked          = stock > 0 but at/under reorder → GENUINELY low
--   reorder_level_zero       = SKUs with no reorder point set at all
SELECT
  COUNT(*)                                                              AS active_skus,
  SUM(CASE WHEN stock <= reorder_level THEN 1 ELSE 0 END)               AS below_reorder,
  SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END)                           AS zero_stock,
  SUM(CASE WHEN stock = 0 AND reorder_level = 0 THEN 1 ELSE 0 END)     AS zero_stock_zero_reorder,
  SUM(CASE WHEN stock > 0 AND stock <= reorder_level THEN 1 ELSE 0 END) AS low_but_stocked,
  SUM(CASE WHEN reorder_level = 0 THEN 1 ELSE 0 END)                    AS reorder_level_zero,
  SUM(CASE WHEN reorder_level > 0 THEN 1 ELSE 0 END)                    AS reorder_level_set,
  CAST(AVG(reorder_level) AS INTEGER)                                  AS avg_reorder,
  MAX(reorder_level)                                                   AS max_reorder,
  CAST(AVG(stock) AS INTEGER)                                          AS avg_stock
FROM inventory WHERE active = 1;

-- 2) Are the below-reorder SKUs actually USED? ------------------------------
--   below_never_used = below reorder but never ordered or consumed → dead rows
--   below_and_used   = below reorder AND has real order/consumption history
SELECT
  SUM(used)       AS below_and_used,
  SUM(1 - used)   AS below_never_used
FROM (
  SELECT
    CASE WHEN EXISTS(SELECT 1 FROM order_items oi WHERE oi.sku = i.sku)
           OR EXISTS(SELECT 1 FROM client_consumption cc WHERE cc.sku = i.sku)
         THEN 1 ELSE 0 END AS used
  FROM inventory i
  WHERE i.active = 1 AND i.stock <= i.reorder_level
);

-- 3) Reorder-level distribution ---------------------------------------------
--   Mostly r0 → the "below" signal is really "stock = 0" (config gap)
--   Lots of r50p with low stock → reorder points may be set too aggressively
SELECT
  SUM(CASE WHEN reorder_level = 0             THEN 1 ELSE 0 END) AS lvl_0,
  SUM(CASE WHEN reorder_level BETWEEN 1 AND 10  THEN 1 ELSE 0 END) AS lvl_1_10,
  SUM(CASE WHEN reorder_level BETWEEN 11 AND 50 THEN 1 ELSE 0 END) AS lvl_11_50,
  SUM(CASE WHEN reorder_level > 50             THEN 1 ELSE 0 END) AS lvl_50_plus
FROM inventory WHERE active = 1;

-- 4) The 15 "worst" below-reorder items that are actually used --------------
--   These are the ones genuinely worth restocking.
SELECT i.sku, i.name, i.stock, i.reorder_level, (i.stock - i.reorder_level) AS gap
FROM inventory i
WHERE i.active = 1 AND i.stock <= i.reorder_level
  AND (EXISTS(SELECT 1 FROM order_items oi WHERE oi.sku = i.sku)
       OR EXISTS(SELECT 1 FROM client_consumption cc WHERE cc.sku = i.sku))
ORDER BY gap ASC, i.name ASC
LIMIT 15;
