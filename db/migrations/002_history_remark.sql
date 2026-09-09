-- Upgrade v1 to v2 once. Stop on error and roll back on failure.
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

ALTER TABLE referral_status_history RENAME COLUMN notes TO remark;
INSERT INTO schema_migrations (version, name) VALUES (2, 'history_remark');

COMMIT;
