-- Upgrade v2 to v3 once. Execute as a transaction with stop-on-error semantics.
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

CREATE TABLE admin_sessions (
    token_hash TEXT PRIMARY KEY NOT NULL CHECK (length(token_hash) = 64),
    admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    credential_version TEXT NOT NULL,
    expires_at DATETIME NOT NULL CHECK (length(expires_at) = 24 AND strftime('%Y-%m-%dT%H:%M:%fZ', expires_at, '+0 days') IS expires_at)
);
CREATE INDEX admin_sessions_admin ON admin_sessions(admin_id);
CREATE INDEX admin_sessions_expiry ON admin_sessions(expires_at);

CREATE TABLE auth_rate_limits (
    bucket TEXT PRIMARY KEY NOT NULL,
    attempts INTEGER NOT NULL CHECK (attempts > 0),
    expires_at DATETIME NOT NULL CHECK (length(expires_at) = 24 AND strftime('%Y-%m-%dT%H:%M:%fZ', expires_at, '+0 days') IS expires_at)
);
CREATE INDEX auth_rate_limits_expiry ON auth_rate_limits(expires_at);

INSERT INTO schema_migrations (version, name) VALUES (3, 'admin_sessions');
COMMIT;
