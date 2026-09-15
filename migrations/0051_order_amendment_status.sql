-- Amendment lifecycle: APPLIED (pending the client's approval) or REJECTED
-- (the client rejected the change and the order was reverted to its prior version).
ALTER TABLE order_amendments ADD COLUMN status TEXT NOT NULL DEFAULT 'APPLIED';
