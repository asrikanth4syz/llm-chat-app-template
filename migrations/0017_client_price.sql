-- Migration 0017: Per-client pricing on catalog assignments
ALTER TABLE client_catalog ADD COLUMN client_price REAL;
