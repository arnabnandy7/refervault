-- Upgrade schema v0 to v1 once. Use a stop-on-error runner.
-- Foreign keys must be disabled BEFORE the transaction, then restored.
PRAGMA foreign_keys = OFF;
BEGIN IMMEDIATE;

CREATE TEMP TABLE migration_guard (ok INTEGER NOT NULL CHECK (ok = 1));

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);
INSERT INTO migration_guard SELECT NOT EXISTS (SELECT 1 FROM schema_migrations);

CREATE TABLE admins_v1 (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE
        CHECK (length(trim(email)) > 0 AND email = trim(email)),
    -- Full library-generated Argon2id PHC string: parameters, salt, and hash.
    -- This guard catches obvious mistakes; hashing/verification belong in the app.
    password_hash TEXT NOT NULL
        CHECK (password_hash GLOB '$argon2id$v=19$m=*,t=*,p=*$*$*'
               AND length(password_hash) >= 80),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    password_changed_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_login_at DATETIME,
    CHECK (created_at IS NULL OR (typeof(created_at) = 'text' AND length(created_at) = 24 AND created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND substr(created_at, 1, 4) BETWEEN '0001' AND '9999' AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at)),
    CHECK (password_changed_at IS NULL OR (typeof(password_changed_at) = 'text' AND length(password_changed_at) = 24 AND password_changed_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND substr(password_changed_at, 1, 4) BETWEEN '0001' AND '9999' AND strftime('%Y-%m-%dT%H:%M:%fZ', password_changed_at, '+0 days') IS password_changed_at)),
    CHECK (last_login_at IS NULL OR (typeof(last_login_at) = 'text' AND length(last_login_at) = 24 AND last_login_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND substr(last_login_at, 1, 4) BETWEEN '0001' AND '9999' AND strftime('%Y-%m-%dT%H:%M:%fZ', last_login_at, '+0 days') IS last_login_at))
);

INSERT INTO admins_v1 (id, email, password_hash, is_active, created_at, password_changed_at, last_login_at) SELECT id, email, password_hash, is_active, created_at, password_changed_at, last_login_at FROM admins;

CREATE TABLE candidates_v1 (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    dob DATE, -- Optional date of birth in YYYY-MM-DD format.
    linkedin_url TEXT,
    current_location TEXT,
    preferred_locations TEXT,
    skillset TEXT,
    experience_raw TEXT,
    experience_months INTEGER CHECK (experience_months >= 0),
    notice_period_days INTEGER CHECK (notice_period_days >= 0),
    last_working_date DATE, -- YYYY-MM-DD, when known
    availability_notes TEXT,
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CHECK (dob IS NULL OR (typeof(dob) = 'text' AND length(dob) = 10 AND dob GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(dob, 1, 4) BETWEEN '0001' AND '9999' AND date(dob, '+0 days') IS dob)),
    CHECK (last_working_date IS NULL OR (typeof(last_working_date) = 'text' AND length(last_working_date) = 10 AND last_working_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(last_working_date, 1, 4) BETWEEN '0001' AND '9999' AND date(last_working_date, '+0 days') IS last_working_date)),
    CHECK (created_at IS NULL OR (typeof(created_at) = 'text' AND length(created_at) = 24 AND created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND substr(created_at, 1, 4) BETWEEN '0001' AND '9999' AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at))
);

INSERT INTO candidates_v1 (id, name, dob, linkedin_url, current_location, preferred_locations, skillset, experience_raw, experience_months, notice_period_days, last_working_date, availability_notes, created_at) SELECT id, name, dob, linkedin_url, current_location, preferred_locations, skillset, experience_raw, experience_months, notice_period_days, last_working_date, availability_notes, created_at FROM candidates;

CREATE TABLE referrals_v1 (
    id INTEGER PRIMARY KEY,
    candidate_id INTEGER NOT NULL REFERENCES candidates(id),
    company_id INTEGER REFERENCES companies(id),
    job_id INTEGER,
    referred_email TEXT, -- Exact submitted email, including any +alias.
    referred_date DATE, -- YYYY-MM-DD; NULL for blank/NA or not yet referred.
    status_code TEXT NOT NULL DEFAULT 'unknown' REFERENCES referral_statuses(code),
    referral_destination TEXT, -- Original "Referred To"; not necessarily a company.
    poc_id INTEGER REFERENCES contacts(id),
    skillset_snapshot TEXT,
    experience_raw TEXT,
    notice_period_raw TEXT,
    remarks TEXT,
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (job_id, company_id) REFERENCES jobs(id, company_id),
    CHECK (job_id IS NULL OR company_id IS NOT NULL),
    CHECK (referred_date IS NULL OR (typeof(referred_date) = 'text' AND length(referred_date) = 10 AND referred_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(referred_date, 1, 4) BETWEEN '0001' AND '9999' AND date(referred_date, '+0 days') IS referred_date)),
    CHECK (created_at IS NULL OR (typeof(created_at) = 'text' AND length(created_at) = 24 AND created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND substr(created_at, 1, 4) BETWEEN '0001' AND '9999' AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at))
);

INSERT INTO referrals_v1 (id, candidate_id, company_id, job_id, referred_email, referred_date, status_code, referral_destination, poc_id, skillset_snapshot, experience_raw, notice_period_raw, remarks, created_at) SELECT id, candidate_id, company_id, job_id, referred_email, referred_date, status_code, referral_destination, poc_id, skillset_snapshot, experience_raw, notice_period_raw, remarks, created_at FROM referrals;

CREATE TABLE referral_status_history_v1 (
    id INTEGER PRIMARY KEY,
    referral_id INTEGER NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    status_code TEXT NOT NULL REFERENCES referral_statuses(code),
    recorded_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    notes TEXT,
    CHECK (recorded_at IS NULL OR (typeof(recorded_at) = 'text' AND length(recorded_at) = 24 AND recorded_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND substr(recorded_at, 1, 4) BETWEEN '0001' AND '9999' AND strftime('%Y-%m-%dT%H:%M:%fZ', recorded_at, '+0 days') IS recorded_at))
);

INSERT INTO referral_status_history_v1 (id, referral_id, status_code, recorded_at, notes) SELECT id, referral_id, status_code, recorded_at, notes FROM referral_status_history;

CREATE TABLE import_rows_v1 (
    id INTEGER PRIMARY KEY,
    source_file TEXT NOT NULL,
    sheet_name TEXT NOT NULL,
    row_number INTEGER NOT NULL CHECK (row_number > 0),
    raw_values_json TEXT NOT NULL, -- JSON object keyed by the 16 original headers.
    candidate_id INTEGER REFERENCES candidates(id),
    referral_id INTEGER REFERENCES referrals(id),
    imported_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CHECK (imported_at IS NULL OR (typeof(imported_at) = 'text' AND length(imported_at) = 24 AND imported_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND substr(imported_at, 1, 4) BETWEEN '0001' AND '9999' AND strftime('%Y-%m-%dT%H:%M:%fZ', imported_at, '+0 days') IS imported_at))
);

INSERT INTO import_rows_v1 (id, source_file, sheet_name, row_number, raw_values_json, candidate_id, referral_id, imported_at) SELECT id, source_file, sheet_name, row_number, raw_values_json, candidate_id, referral_id, imported_at FROM import_rows;

DROP TABLE import_rows;

DROP TABLE referral_status_history;

DROP TABLE referrals;

DROP TABLE candidates;

DROP TABLE admins;

ALTER TABLE admins_v1 RENAME TO admins;

ALTER TABLE candidates_v1 RENAME TO candidates;

ALTER TABLE referrals_v1 RENAME TO referrals;

ALTER TABLE referral_status_history_v1 RENAME TO referral_status_history;

ALTER TABLE import_rows_v1 RENAME TO import_rows;

CREATE INDEX import_rows_candidate ON import_rows(candidate_id);

CREATE INDEX import_rows_referral ON import_rows(referral_id);

CREATE INDEX import_rows_source ON import_rows(source_file, sheet_name, row_number);

CREATE INDEX referral_status_history_referral ON referral_status_history(referral_id, id);

CREATE INDEX referrals_candidate ON referrals(candidate_id);

CREATE INDEX referrals_company_job ON referrals(company_id, job_id);

CREATE INDEX referrals_date ON referrals(referred_date);

CREATE INDEX referrals_job ON referrals(job_id);

CREATE INDEX referrals_poc ON referrals(poc_id);

CREATE INDEX referrals_status_date ON referrals(status_code, referred_date);

CREATE TRIGGER admins_password_changed AFTER UPDATE OF password_hash ON admins
WHEN OLD.password_hash <> NEW.password_hash
BEGIN
    UPDATE admins
    SET password_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER referrals_initial_status AFTER INSERT ON referrals
BEGIN
    INSERT INTO referral_status_history (referral_id, status_code)
    VALUES (NEW.id, NEW.status_code);
END;

CREATE TRIGGER referrals_status_changed AFTER UPDATE OF status_code ON referrals
WHEN OLD.status_code <> NEW.status_code
BEGIN
    INSERT INTO referral_status_history (referral_id, status_code)
    VALUES (NEW.id, NEW.status_code);
END;

INSERT INTO migration_guard SELECT NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check);

DROP TABLE migration_guard;

INSERT INTO schema_migrations (version, name) VALUES (1, 'validate_dates');

COMMIT;

PRAGMA foreign_keys = ON;
