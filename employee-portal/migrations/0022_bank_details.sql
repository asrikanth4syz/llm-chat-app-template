-- Structured employee bank details (KYC). The account NUMBER reuses the existing
-- employees.bank_account column (AES-GCM encrypted, masked on read). The rest are
-- sensitive-but-shown-to-authorised (like CTC). The cancelled-cheque / passbook image is
-- kept in its own column and fetched on demand (never in list/profile payloads).

ALTER TABLE employees ADD COLUMN bank_payee_name   TEXT;    -- account holder / payee name
ALTER TABLE employees ADD COLUMN bank_ifsc         TEXT;    -- IFSC code
ALTER TABLE employees ADD COLUMN bank_account_type TEXT;    -- savings | current
ALTER TABLE employees ADD COLUMN bank_name         TEXT;    -- bank name
ALTER TABLE employees ADD COLUMN bank_proof        TEXT;    -- data URL: cancelled cheque / passbook page
ALTER TABLE employees ADD COLUMN bank_verified     INTEGER NOT NULL DEFAULT 0; -- HR-verified KYC flag

-- The demo employees already have a seeded account number; mark their KYC verified.
UPDATE employees SET bank_verified = 1, bank_account_type = 'savings' WHERE bank_account IS NOT NULL AND bank_account != '';
