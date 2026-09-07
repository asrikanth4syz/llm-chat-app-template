-- GST 2.0: aerated / sweetened / carbonated beverages moved from 28% to the new
-- 40% demerit slab. Bump the HSN → GST map and any inventory items still on 28%.
-- Only rows still at 28% are touched, so an explicit admin edit is never overwritten.
UPDATE hsn_gst_rates SET gst_rate = 40 WHERE hsn IN ('220210','2202') AND gst_rate = 28;
UPDATE inventory     SET gst_rate = 40 WHERE hsn_code IN ('220210','2202') AND gst_rate = 28;
