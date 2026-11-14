-- Access revocation (R0 NFR): a per-user token version. Every issued JWT carries
-- the user's token_version; a request is rejected when they no longer match.
-- Bumping it on exit or role change kills all of that user's live sessions at
-- once, meeting the "sessions killed within 1 hour of exit/role change" SLA.
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
