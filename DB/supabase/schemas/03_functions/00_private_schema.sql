-- Schema NOT exposed through the API: holds helpers used by policies/triggers.
-- (Make sure "private" is not listed in the API "Exposed schemas" setting.)
CREATE SCHEMA IF NOT EXISTS private;

GRANT USAGE ON SCHEMA private TO authenticated;
