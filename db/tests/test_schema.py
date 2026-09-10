import sqlite3
import unittest
from pathlib import Path


SCHEMA = Path(__file__).resolve().parents[1] / "schema.sql"


class SchemaTests(unittest.TestCase):
    # Format-only fixture, deliberately not a usable password hash.
    HASH_FIXTURE = '$argon2id$v=19$m=19456,t=2,p=1$' + 'A' * 22 + '$' + 'B' * 43

    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.db.executescript(SCHEMA.read_text(encoding="utf-8"))
        self.db.execute("INSERT INTO candidates (id, name) VALUES (1, 'Example Candidate')")

    def test_admin_credentials_constraints(self):
        self.db.execute(
            "INSERT INTO admins (email, password_hash) VALUES (?, ?)",
            ('admin@example.test', self.HASH_FIXTURE),
        )
        for email, password_hash in (
            ('ADMIN@example.test', self.HASH_FIXTURE),
            ('other@example.test', 'plaintext-password'),
            ('other@example.test', 'a' * 64),
            ('other@example.test', None),
            ('', self.HASH_FIXTURE),
            (' admin@example.test ', self.HASH_FIXTURE),
        ):
            with self.subTest(email=email, password_hash=password_hash):
                with self.assertRaises(sqlite3.IntegrityError):
                    self.db.execute(
                        "INSERT INTO admins (email, password_hash) VALUES (?, ?)",
                        (email, password_hash),
                    )
        self.assertEqual(self.db.execute("SELECT is_active, last_login_at FROM admins").fetchone(), (1, None))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE admins SET is_active = 2")

    def test_admin_password_timestamp_changes_only_on_new_hash(self):
        self.db.execute(
            "INSERT INTO admins (email, password_hash, password_changed_at) VALUES (?, ?, ?)",
            ('admin@example.test', self.HASH_FIXTURE, '2000-01-01T00:00:00.000Z'),
        )
        self.db.execute("UPDATE admins SET password_hash = password_hash, is_active = 0")
        self.assertEqual(self.db.execute("SELECT password_changed_at FROM admins").fetchone()[0], '2000-01-01T00:00:00.000Z')
        self.db.execute("UPDATE admins SET password_hash = ?", (self.HASH_FIXTURE[:-1] + 'C',))
        self.assertNotEqual(self.db.execute("SELECT password_changed_at FROM admins").fetchone()[0], '2000-01-01T00:00:00.000Z')

    def test_dashboard_preferences_require_an_admin_and_json_array(self):
        self.db.execute(
            "INSERT INTO admins (id, email, password_hash) VALUES (1, ?, ?)",
            ('admin@example.test', self.HASH_FIXTURE),
        )
        self.db.execute(
            "INSERT INTO admin_dashboard_preferences (admin_id, columns_json) VALUES (1, ?)",
            ('[\"candidateName\",\"jobId\"]',),
        )
        for admin_id, value in ((999, '[]'), (1, '{}'), (1, 'invalid')):
            with self.subTest(admin_id=admin_id, value=value):
                with self.assertRaises(sqlite3.IntegrityError):
                    self.db.execute(
                        "INSERT OR REPLACE INTO admin_dashboard_preferences (admin_id, columns_json) VALUES (?, ?)",
                        (admin_id, value),
                    )
        self.assertIn(
            (4, 'dashboard_preferences'),
            self.db.execute("SELECT version, name FROM schema_migrations").fetchall(),
        )

    def test_repeat_referrals_and_status_history(self):
        self.db.execute("INSERT INTO referrals (id, candidate_id) VALUES (1, 1), (2, 1)")
        self.db.execute("UPDATE referrals SET status_code = 'under_review' WHERE id = 1")
        self.db.execute("UPDATE referrals SET status_code = 'under_review' WHERE id = 1")
        self.db.execute("UPDATE referrals SET status_code = 'unknown' WHERE id = 1")
        statuses = self.db.execute(
            "SELECT status_code FROM referral_status_history WHERE referral_id = 1 ORDER BY id"
        ).fetchall()
        self.assertEqual(statuses, [('unknown',), ('under_review',), ('unknown',)])
        self.assertEqual(self.db.execute("PRAGMA foreign_key_check").fetchall(), [])

    def test_invalid_references_and_status_are_rejected(self):
        for statement in (
            "INSERT INTO referrals (candidate_id) VALUES (999)",
            "INSERT INTO referrals (candidate_id, status_code) VALUES (1, 'typo')",
        ):
            with self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(statement)

    def test_job_company_consistency_and_leading_zeros(self):
        self.db.execute("INSERT INTO companies (id, name) VALUES (1, 'Example'), (2, 'Other')")
        self.db.execute("INSERT INTO jobs (id, company_id, job_code) VALUES (1, 1, '000123')")
        self.db.execute("INSERT INTO referrals (candidate_id, company_id, job_id) VALUES (1, 1, 1)")
        for company in (2, None):
            with self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(
                    "INSERT INTO referrals (candidate_id, company_id, job_id) VALUES (1, ?, 1)",
                    (company,),
                )
        self.assertEqual(self.db.execute("SELECT job_code FROM jobs").fetchone()[0], '000123')

    def test_multiple_contacts_but_one_primary_per_type(self):
        self.db.execute("INSERT INTO candidate_contacts (candidate_id, contact_type, value, is_primary) VALUES (1, 'email', 'one@example.test', 1)")
        self.db.execute("INSERT INTO candidate_contacts (candidate_id, contact_type, value) VALUES (1, 'email', 'two@example.test')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE candidate_contacts SET is_primary = 1 WHERE value = 'two@example.test'")

    def test_history_rolls_back_with_status_and_candidate_is_protected(self):
        self.db.execute("INSERT INTO referrals (id, candidate_id) VALUES (1, 1)")
        self.db.commit()
        self.db.execute("UPDATE referrals SET status_code = 'joined' WHERE id = 1")
        self.db.rollback()
        self.assertEqual(self.db.execute("SELECT status_code FROM referrals").fetchone()[0], 'unknown')
        self.assertEqual(self.db.execute("SELECT count(*) FROM referral_status_history").fetchone()[0], 1)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM candidates WHERE id = 1")


if __name__ == "__main__":
    unittest.main()
