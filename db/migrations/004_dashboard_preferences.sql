-- Upgrade v3 to v4 once. Execute with stop-on-error semantics.
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

CREATE TABLE admin_dashboard_preferences (
    admin_id INTEGER PRIMARY KEY REFERENCES admins(id) ON DELETE CASCADE,
    columns_json TEXT NOT NULL
        CHECK (json_valid(columns_json) AND json_type(columns_json) = 'array'),
    updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CHECK (length(updated_at) = 24 AND strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)
);

INSERT INTO schema_migrations (version, name)
VALUES (4, 'dashboard_preferences');

COMMIT;
