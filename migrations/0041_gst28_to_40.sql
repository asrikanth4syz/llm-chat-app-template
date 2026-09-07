-- GST 2.0 retired the 28% slab. In this pantry catalogue 28% only ever applied to
-- aerated/sugary drinks, which move to the 40% demerit slab. Many such items were
-- never tagged with the aerated HSN, so an HSN-based recalc misses them — reconcile
-- every remaining 28% inventory item to 40% (one-time; the migration runs once).
UPDATE inventory SET gst_rate = 40 WHERE gst_rate = 28;
