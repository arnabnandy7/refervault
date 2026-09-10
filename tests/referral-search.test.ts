import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { parseReferralFilters, searchReferrals } from "../lib/referral-search";

test("referral search applies every supported filter and validates dates", async () => {
  const db = createClient({ url: ":memory:" });
  await db.batch([
    "CREATE TABLE candidates (id INTEGER PRIMARY KEY, name TEXT, skillset TEXT, experience_raw TEXT, current_location TEXT, preferred_locations TEXT, linkedin_url TEXT)",
    "CREATE TABLE candidate_contacts (candidate_id INTEGER, contact_type TEXT, value TEXT)",
    "CREATE TABLE referral_statuses (code TEXT PRIMARY KEY, label TEXT)",
    "CREATE TABLE companies (id INTEGER PRIMARY KEY, name TEXT)",
    "CREATE TABLE jobs (id INTEGER PRIMARY KEY, job_code TEXT)",
    "CREATE TABLE contacts (id INTEGER PRIMARY KEY, raw_label TEXT, name TEXT, external_id TEXT)",
    "CREATE TABLE referrals (id INTEGER PRIMARY KEY, candidate_id INTEGER, company_id INTEGER, job_id INTEGER, referred_email TEXT, referred_date TEXT, status_code TEXT, poc_id INTEGER, skillset_snapshot TEXT, created_at TEXT, referral_destination TEXT, notice_period_raw TEXT, remarks TEXT, experience_raw TEXT)",
    "INSERT INTO candidates VALUES (1, 'Priya Sharma', 'Java', '5 years', 'Kolkata', 'Bengaluru', 'https://example.test/priya'), (2, 'Other Person', 'Python', NULL, NULL, NULL, NULL)",
    "INSERT INTO candidate_contacts VALUES (1, 'email', 'priya@example.com'), (1, 'phone', '9876543210'), (2, 'email', 'other@example.com')",
    "INSERT INTO referral_statuses VALUES ('referred', 'Referred'), ('rejected', 'Rejected')",
    "INSERT INTO companies VALUES (1, 'Cognizant')",
    "INSERT INTO jobs VALUES (1, 'JOB-123'), (2, 'OTHER-9')",
    "INSERT INTO contacts VALUES (1, 'Arnab (1001)', NULL, NULL)",
    "INSERT INTO referrals VALUES (1, 1, 1, 1, 'priya+refer@example.com', '2026-09-01', 'referred', 1, 'Java Spring', '2026-09-01T00:00:00.000Z', 'Portal', '30', 'Strong profile', '5 years'), (2, 2, 1, 2, 'other+refer@example.com', '2026-08-01', 'rejected', NULL, 'Python', '2026-08-01T00:00:00.000Z', NULL, NULL, NULL, NULL)",
  ], "write");

  const searches = [
    { dateFrom: "2026-09-01", dateTo: "2026-09-01" },
    { candidateName: "priya" }, { jobId: "123" },
    { originalEmail: "PRIYA@EXAMPLE.COM" }, { referredEmail: "priya+refer" },
    { status: "referred" }, { poc: "1001" }, { skillset: "spring" },
  ];
  for (const raw of searches) {
    const result = await searchReferrals(db, parseReferralFilters(raw));
    assert.equal(result.total, 1);
    assert.equal(result.rows[0].candidateName, "Priya Sharma");
  }
  assert.equal(parseReferralFilters({ dateFrom: "2026-02-30" }).dateFrom, "");
  const row = (await searchReferrals(db, parseReferralFilters({ candidateName: "priya" }))).rows[0];
  assert.equal(row.mobileNumbers, "9876543210");
  assert.equal(row.experience, "5 years");
  assert.equal(row.referredTo, "Portal");
  assert.equal(row.currentLocation, "Kolkata");
  assert.equal(row.preferredLocation, "Bengaluru");
  assert.equal(row.noticePeriod, "30");
  assert.equal(row.remarks, "Strong profile");
  assert.equal(row.linkedin, "https://example.test/priya");
  db.close();
});
