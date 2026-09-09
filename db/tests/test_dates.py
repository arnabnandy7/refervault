import sqlite3
import unittest
from pathlib import Path

DB = Path(__file__).resolve().parents[1]
MIGRATION = (DB / 'migrations/001_validate_dates.sql').read_text()


class DateTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.executescript((DB / 'schema.sql').read_text())
        self.db.execute("INSERT INTO candidates (id, name) VALUES (1, 'Example')")
        self.db.execute("INSERT INTO referrals (id, candidate_id) VALUES (1, 1)")

    def test_calendar_dates_on_insert_and_update(self):
        for value in (None, '2000-02-29', '2024-02-29', '0001-01-01', '9999-12-31'):
            for table, column in (('candidates', 'dob'), ('candidates', 'last_working_date'), ('referrals', 'referred_date')):
                self.db.execute(f'UPDATE {table} SET {column} = ? WHERE id = 1', (value,))
        for value in ('', 'NA', 'now', '2023-02-29', '1900-02-29', '2024-02-30', '2024-04-31', '2024-13-01', '2024-00-01', '2024-01-00', '0000-01-01', '2024-2-01', '01/02/2024', '2024-01-01T00:00:00Z', 46274, b'2024-01-01'):
            for table, column in (('candidates', 'dob'), ('candidates', 'last_working_date'), ('referrals', 'referred_date')):
                with self.subTest(table=table, column=column, value=value):
                    with self.assertRaises(sqlite3.IntegrityError):
                        self.db.execute(f'UPDATE {table} SET {column} = ? WHERE id = 1', (value,))
            with self.assertRaises(sqlite3.IntegrityError):
                self.db.execute("INSERT INTO candidates (name, dob) VALUES ('Invalid', ?)", (value,))

    def test_utc_timestamps(self):
        for value in ('2024-02-29T23:59:59.123Z', '2000-01-01T00:00:00.000Z'):
            self.db.execute('UPDATE candidates SET created_at = ?', (value,))
        for value in (None, '', 'now', '2024-02-30T12:00:00.000Z', '2024-01-01T24:00:00.000Z', '2024-01-01T12:60:00.000Z', '2024-01-01T12:00:60.000Z', '2024-01-01', '2024-01-01 12:00:00', '2024-01-01T12:00:00Z', '2024-01-01T12:00:00.000+05:30'):
            with self.subTest(value=value):
                with self.assertRaises(sqlite3.IntegrityError):
                    self.db.execute('UPDATE candidates SET created_at = ?', (value,))
        self.assertEqual(self.db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.executescript((DB / 'tests/fixtures/schema_v0.sql').read_text())
        self.db.execute("INSERT INTO candidates (id, name, dob) VALUES (1, 'Example', '2000-02-29')")
        self.db.execute("INSERT INTO candidate_contacts (candidate_id, contact_type, value) VALUES (1, 'email', 'example@example.test')")
        self.db.execute("INSERT INTO referrals (id, candidate_id, referred_date) VALUES (1, 1, '2024-02-29')")
        self.db.execute("INSERT INTO import_rows (source_file, sheet_name, row_number, raw_values_json, candidate_id, referral_id) VALUES ('example', 'ProfileList', 2, '{}', 1, 1)")
        self.db.commit()

    def test_migration_preserves_rows_relationships_and_history(self):
        before = {table: self.db.execute(f'SELECT * FROM {table}').fetchall() for table in ('candidates', 'candidate_contacts', 'referrals', 'referral_status_history', 'import_rows')}
        self.db.executescript(MIGRATION)
        for table, rows in before.items():
            self.assertEqual(self.db.execute(f'SELECT * FROM {table}').fetchall(), rows)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])
        self.assertEqual(self.db.execute('PRAGMA foreign_keys').fetchone()[0], 1)
        self.assertEqual(self.db.execute('SELECT version FROM schema_migrations').fetchone()[0], 1)
        self.db.execute("UPDATE referrals SET status_code = 'joined' WHERE id = 1")
        self.assertEqual(self.db.execute('SELECT count(*) FROM referral_status_history').fetchone()[0], 2)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE candidates SET dob = '2023-02-29'")

    def test_invalid_legacy_date_aborts_without_data_loss(self):
        self.db.execute("UPDATE candidates SET dob = '2023-02-29'")
        self.db.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.executescript(MIGRATION)
        self.db.rollback()
        self.db.execute('PRAGMA foreign_keys = ON')
        self.assertEqual(self.db.execute('SELECT dob FROM candidates').fetchone()[0], '2023-02-29')
        self.assertEqual(self.db.execute("SELECT count(*) FROM sqlite_schema WHERE name = 'schema_migrations'").fetchone()[0], 0)
        self.assertEqual(self.db.execute("SELECT count(*) FROM sqlite_schema WHERE name LIKE '%_v1'").fetchone()[0], 0)
