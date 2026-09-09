-- Initial schema for a new SQLite/libSQL database. Run once.
-- Enable foreign keys on EVERY application connection as well.
PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

CREATE TABLE admins (
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

CREATE TRIGGER admins_password_changed AFTER UPDATE OF password_hash ON admins
WHEN OLD.password_hash <> NEW.password_hash
BEGIN
    UPDATE admins
    SET password_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = NEW.id;
END;

CREATE TABLE candidates (
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

CREATE TABLE candidate_contacts (
    id INTEGER PRIMARY KEY,
    candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    contact_type TEXT NOT NULL CHECK (contact_type IN ('email', 'phone')),
    value TEXT NOT NULL CHECK (length(trim(value)) > 0),
    is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
    UNIQUE (candidate_id, contact_type, value)
);
CREATE UNIQUE INDEX candidate_contacts_primary
    ON candidate_contacts(candidate_id, contact_type) WHERE is_primary = 1;
CREATE INDEX candidate_contacts_lookup ON candidate_contacts(contact_type, value);

CREATE TABLE companies (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(name)) > 0)
);

CREATE TABLE jobs (
    id INTEGER PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    job_code TEXT NOT NULL CHECK (length(trim(job_code)) > 0),
    role_title TEXT,
    UNIQUE (company_id, job_code),
    UNIQUE (id, company_id)
);

CREATE TABLE contacts (
    id INTEGER PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    name TEXT,
    external_id TEXT,
    raw_label TEXT, -- Preserve PoC labels until name/reference ID can be resolved.
    CHECK (length(trim(coalesce(name, '') || coalesce(external_id, '') || coalesce(raw_label, ''))) > 0)
);
CREATE INDEX contacts_company ON contacts(company_id);

CREATE TABLE referral_statuses (
    code TEXT PRIMARY KEY NOT NULL,
    label TEXT NOT NULL UNIQUE
);
-- Keep distinct legacy labels; do not infer that an empty status means referred.
INSERT INTO referral_statuses (code, label) VALUES
    ('unknown', 'Unknown'),
    ('referred', 'Referred'),
    ('not_suitable', 'Not Suitable'),
    ('not_referred', 'Not Referred'),
    ('rejected', 'Rejected'),
    ('under_review', 'Under Review'),
    ('not_considered', 'Not considered'),
    ('offer_received', 'Offer Received'),
    ('offer_accepted', 'Offer Accepted'),
    ('hr_tag_referral', 'HR TAG referral'),
    ('not_interested', 'Not Interested'),
    ('offer_in_progress', 'Offer In Progress'),
    ('old_refer', 'Old Refer'),
    ('on_hold', 'On Hold'),
    ('joined', 'Joined'),
    ('not_reachable', 'Not Reachable'),
    ('withdrawn', 'Withdrawn'),
    ('offer_delayed', 'Offer Delayed'),
    ('wrong_referral', 'Wrong Referral'),
    ('not_shortlisted', 'Not Shortlisted'),
    ('cancelled', 'Cancelled'),
    ('no_show', 'No show'),
    ('lwd_expired', 'LWD Expired'),
    ('l2_pending', 'L2 Pending'),
    ('screening_select', 'Screening Select'),
    ('selected', 'Selected'),
    ('submitted_for_review', 'Submitted for review'),
    ('l1_pending', 'L1 Pending'),
    ('unused', 'Unused'),
    ('offer_declined', 'Offer Declined'),
    ('duplicate_refer', 'Duplicate Refer');

CREATE TABLE referrals (
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
-- Deliberately no candidate/job uniqueness: repeat referrals can be valid.
CREATE INDEX referrals_candidate ON referrals(candidate_id);
CREATE INDEX referrals_company_job ON referrals(company_id, job_id);
CREATE INDEX referrals_job ON referrals(job_id);
CREATE INDEX referrals_poc ON referrals(poc_id);
CREATE INDEX referrals_status_date ON referrals(status_code, referred_date);
CREATE INDEX referrals_date ON referrals(referred_date);

CREATE TABLE referral_status_history (
    id INTEGER PRIMARY KEY,
    referral_id INTEGER NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    status_code TEXT NOT NULL REFERENCES referral_statuses(code),
    recorded_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    remark TEXT,
    CHECK (recorded_at IS NULL OR (typeof(recorded_at) = 'text' AND length(recorded_at) = 24 AND recorded_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z' AND substr(recorded_at, 1, 4) BETWEEN '0001' AND '9999' AND strftime('%Y-%m-%dT%H:%M:%fZ', recorded_at, '+0 days') IS recorded_at))
);
CREATE INDEX referral_status_history_referral ON referral_status_history(referral_id, id);

-- Timestamps record when the database observed a status, not an inferred event date.
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

CREATE TABLE import_rows (
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
CREATE INDEX import_rows_source ON import_rows(source_file, sheet_name, row_number);
CREATE INDEX import_rows_candidate ON import_rows(candidate_id);
CREATE INDEX import_rows_referral ON import_rows(referral_id);

CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);
INSERT INTO schema_migrations (version, name) VALUES (1, 'validate_dates');
INSERT INTO schema_migrations (version, name) VALUES (2, 'history_remark');


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
