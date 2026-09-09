# Database

`schema.sql` initializes a new SQLite/libSQL database for ReferVault. It creates
tables, indexes, status labels, and triggers in one transaction. It intentionally
fails on an existing schema; it is not an upgrade script. Future changes should
be versioned migrations rather than edits applied to a populated database.

With the SQLite CLI installed, run from the repository root:

```sh
sqlite3 refervault.db ".read db/schema.sql"
```

Enable `PRAGMA foreign_keys = ON` on every application connection, before starting
transactions. The script does this for its own connection.

## Dates and timestamps

- `candidates.dob`, `candidates.last_working_date`, and `referrals.referred_date`
  are nullable `DATE` columns. Pass calendar dates as `YYYY-MM-DD`, without timezone
  conversion, and use SQL NULL when unknown. DOB has no spreadsheet source column.
- All `*_at` columns are declared `DATETIME` and store UTC timestamps in exactly
  `YYYY-MM-DDTHH:mm:ss.SSSZ` format. `last_login_at` is nullable; other audit
  timestamps are required and default to the current UTC time.
- CHECK constraints enforce format and actual calendar validity, including leap
  years, for years 0001–9999. They reject empty strings, `NA`, Excel serials,
  impossible dates, and timestamps without the canonical UTC format. NULL results
  from date functions cannot bypass these checks.
- The application should validate for friendly errors and convert timestamp
  offsets to UTC before writing. Keep date-only inputs unchanged; converting DOB
  through a local-time JavaScript Date can shift the calendar day. Render audit
  timestamps in the user's timezone only for display. Do not infer unknown dates.

Turso's non-STRICT type declarations alone do not validate dates; the CHECK
constraints provide that enforcement. See [Turso data types](https://docs.turso.tech/sql-reference/data-types)
and [SQLite date functions](https://www.sqlite.org/lang_datefunc.html).

`migrations/001_validate_dates.sql` upgrades the previously deployed v0 schema to
v1 while preserving records, IDs, indexes, triggers, and relationships. It rebuilds
the five affected tables in one transaction and checks foreign keys before commit.
Invalid existing values cause failure rather than silent conversion. Use a runner
that stops at the first SQL error, rolls back, and restores foreign key enforcement
(or closes the connection). Do not run it inside another transaction. It requires
an unversioned database and records version 1 in `schema_migrations` on success;
new `schema.sql` databases already include all migrations and must not rerun them.

`migrations/002_history_remark.sql` upgrades v1 to v2 by renaming history `notes`
to nullable `remark TEXT`, preserving existing values.

## Admin authentication

`admins` uses a unique, case-insensitive email for login, an Argon2id
`password_hash`, an account-active flag, and creation/password-change/last-login
timestamps. There is no seeded admin or default password.

The application must hash passwords server-side with a maintained Argon2id
library before inserting them using parameterized SQL. Store the complete PHC
encoded result, including the library-generated random salt and cost parameters.
Use at least 19 MiB memory (`m=19456` KiB), 2 iterations, and parallelism 1;
benchmark stronger settings on the deployment runtime. These minimums follow
[OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
Never store plaintext, reversible encryption, or a plain SHA hash of a password.
No separate salt column is needed.

On login, trim the email and use the library's password verification API against
the stored hash; do not compare freshly generated hashes. Reject inactive
accounts, use generic failure messages, and rate-limit attempts. Update
`last_login_at` only after successful authentication. Rehash after verification
when the library reports outdated parameters. Password hash changes automatically
refresh `password_changed_at`; session revocation must be handled by the future
authentication layer.

The SQL hash-format check only rejects obvious storage mistakes. It cannot prove
that a value is a valid hash or enforce its cryptographic strength. The application
must perform hashing and verification. Login routes use database-backed sessions,
installed by migration 003. Never return `password_hash` in API responses or write passwords or
hashes to logs.

## Spreadsheet mapping

Source: the `ProfileList` sheet (second tab), columns A:P.

| Excel column | Destination |
| --- | --- |
| Candidate Name | `candidates.name` |
| Referred Email ID | `referrals.referred_email` |
| Original Email ID | `candidate_contacts` with type `email` |
| Mobile No | `candidate_contacts` with type `phone` |
| Experience | `referrals.experience_raw`; reviewed current value on `candidates` |
| Skillset | `referrals.skillset_snapshot`; reviewed current value on `candidates` |
| Referred Date | `referrals.referred_date` |
| Status | `referrals.status_code` via `referral_statuses` |
| Referred To | `referrals.referral_destination` |
| Current Location | `candidates.current_location` |
| Preferred Location | `candidates.preferred_locations` (free text initially) |
| Notice Period (Days) | `referrals.notice_period_raw`; parsed candidate availability when unambiguous |
| Remarks | `referrals.remarks` |
| Job Code | `jobs.job_code` through `referrals.job_id` |
| PoC | `contacts.raw_label`, with optional resolved name and external ID |
| LinkedIn | `candidates.linkedin_url` |

## Import rules

- Preserve every source row in `import_rows.raw_values_json` before normalization.
  It can be linked to a candidate/referral after review. No candidate data is
  included in this repository, and this script does not import the workbook.
- Split multiple original emails/phone numbers into contact rows. Store phone
  numbers and job codes as text, preserving leading zeros. Keep submitted email
  aliases exactly as recorded; do not generate them from the job code.
- Use contact matches to suggest candidate matches, not names alone. Repeated
  candidates, repeated referrals, and duplicate source rows need separate review.
  Contact values are unique only within a candidate/type, not across people.
- Keep `experience_raw` until years/months versus decimal-year notation is
  confirmed. `experience_months` is optional. Preserve notice-period prose;
  populate days and last working date only when unambiguous.
- Convert Excel date serials using the workbook's date system. Blank/`NA` dates
  become NULL. Blank status becomes `unknown`; preserve all other legacy labels.
- Do not derive the employer from `Referred To`: it mixes channels, destinations,
  and duplicate markers. Supply the company when confirmed. A referral may lack
  a company or job; a linked job requires the same company on the referral.
- Do not select current candidate attributes by blindly taking the last row;
  preserve historical values in the source rows and referral snapshots.
- Source coordinates are indexed, not unique: filenames can recur with changed
  contents. A future importer must detect repeated imports before writing.

## Status history and deletion

Insert/update `referrals.status_code` to change status. Triggers record the initial
status and each actual change, including transitions back to an earlier status.
Setting the same value adds no history. These are observation timestamps; imported
statuses are recorded at import time, without inventing earlier transitions.
Treat history as read-only except for editing `remark`, an optional text field
for context about the corresponding status entry.

Candidates, companies, jobs, and PoCs referenced by other records cannot be
deleted accidentally. Candidate contacts and referral history cascade when their
parent can be deleted. Import links also prevent deletion of linked records;
explicitly unlink them first if deletion is intended.

Run the schema checks with Python's standard library:

```sh
python -m unittest discover -s db/tests -v
```
