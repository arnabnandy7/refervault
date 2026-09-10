import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createClient } from "@libsql/client";
import { createReferralEntry, updateReferralEntry } from "../lib/referral-entry";

async function testDatabase() {
  const db = createClient({ url: "file::memory:" });
  await db.executeMultiple(await readFile("db/schema.sql", "utf8"));
  return db;
}

function validEntry() {
  const form = new FormData();
  const values = {
    candidateName: "Ananya Sen",
    dob: "1993-02-28",
    originalEmails: "ananya@example.test; ananya.work@example.test",
    mobileNumbers: "9876543210, 9123456780",
    experience: "7+",
    skillset: "TypeScript, React",
    referredEmail: "ananya+000123@example.test",
    referredDate: "2026-09-10",
    statusCode: "referred",
    referredTo: "Job Code",
    company: "Example Corp",
    currentLocation: "Kolkata",
    preferredLocation: "Bengaluru",
    noticePeriod: "30 days",
    remarks: "Strong profile",
    jobCodes: "000123, 000456",
    poc: "Hiring Partner (42)",
    linkedin: "linkedin.com/in/ananya-sen",
  };
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

test("entry form saves the normalized candidate and referral atomically", async () => {
  const db = await testDatabase();
  try {
    const result = await createReferralEntry(db, validEntry());
    assert.equal(result.status, "success");
    const candidate = await db.execute(
      "SELECT name, dob, linkedin_url FROM candidates",
    );
    assert.deepEqual(
      {
        name: candidate.rows[0].name,
        dob: candidate.rows[0].dob,
        linkedin_url: candidate.rows[0].linkedin_url,
      },
      {
        name: "Ananya Sen",
        dob: "1993-02-28",
        linkedin_url: "https://linkedin.com/in/ananya-sen",
      },
    );
    const contacts = await db.execute(
      "SELECT contact_type, value, is_primary FROM candidate_contacts ORDER BY contact_type, value",
    );
    assert.equal(contacts.rows.length, 4);
    assert.equal(contacts.rows.filter((row) => row.is_primary === 1).length, 2);
    const referral = await db.execute(
      "SELECT referred_date, status_code, remarks FROM referrals ORDER BY job_id",
    );
    assert.equal(referral.rows.length, 2);
    assert.deepEqual(
      {
        referred_date: referral.rows[0].referred_date,
        status_code: referral.rows[0].status_code,
        remarks: referral.rows[0].remarks,
      },
      {
        referred_date: "2026-09-10",
        status_code: "referred",
        remarks: "Strong profile",
      },
    );
    assert.equal(
      (
        await db.execute(
          "SELECT group_concat(job_code, ',') AS codes FROM jobs ORDER BY job_code",
        )
      ).rows[0].codes,
      "000123,000456",
    );
    assert.equal(
      (
        await db.execute(
          "SELECT count(*) AS count FROM referral_status_history",
        )
      ).rows[0].count,
      2,
    );
    const raw = JSON.parse(
      String(
        (await db.execute("SELECT raw_values_json FROM import_rows")).rows[0]
          .raw_values_json,
      ),
    );
    assert.equal(raw.DOB, "1993-02-28");
    assert.equal(raw["Job Code"], "000123, 000456");
    assert.equal(
      (await db.execute("SELECT count(*) AS count FROM import_rows")).rows[0]
        .count,
      2,
    );
  } finally {
    db.close();
  }
});

test("entry validation rejects invalid dates and a job without a company", async () => {
  const db = await testDatabase();
  try {
    const form = validEntry();
    form.set("dob", "2023-02-29");
    form.set("referredDate", "2026-02-30");
    form.set("company", "");
    const result = await createReferralEntry(db, form);
    assert.deepEqual(Object.keys(result.errors).sort(), [
      "company",
      "dob",
      "referredDate",
    ]);
    assert.equal(
      (await db.execute("SELECT count(*) AS count FROM candidates")).rows[0]
        .count,
      0,
    );
  } finally {
    db.close();
  }
});

test("entry form adds referrals to a candidate with an existing contact", async () => {
  const db = await testDatabase();
  try {
    assert.equal(
      (await createReferralEntry(db, validEntry())).status,
      "success",
    );
    const result = await createReferralEntry(db, validEntry());
    assert.equal(result.status, "success");
    assert.match(result.message, /2 referrals were saved/);
    assert.equal(
      (await db.execute("SELECT count(*) AS count FROM candidates")).rows[0]
        .count,
      1,
    );
    assert.equal(
      (await db.execute("SELECT count(*) AS count FROM referrals")).rows[0]
        .count,
      4,
    );
  } finally {
    db.close();
  }
});

test("edit form updates the candidate and selected referral", async () => {
  const db = await testDatabase();
  try {
    await createReferralEntry(db, validEntry());
    const referralId = Number((await db.execute("SELECT id FROM referrals ORDER BY job_id LIMIT 1")).rows[0].id);
    const form = validEntry();
    form.set("candidateName", "Ananya S. Sen");
    form.set("mobileNumbers", "9000000000");
    form.set("jobCodes", "000789");
    form.set("statusCode", "under_review");
    form.set("remarks", "Updated note");
    const result = await updateReferralEntry(db, referralId, form);
    assert.equal(result.status, "success");
    const updated = await db.execute({
      sql: `SELECT c.name, j.job_code, r.status_code, r.remarks
        FROM referrals r JOIN candidates c ON c.id=r.candidate_id
        LEFT JOIN jobs j ON j.id=r.job_id WHERE r.id=?`,
      args: [referralId],
    });
    assert.deepEqual(
      { name: updated.rows[0].name, job: updated.rows[0].job_code, status: updated.rows[0].status_code, remarks: updated.rows[0].remarks },
      { name: "Ananya S. Sen", job: "000789", status: "under_review", remarks: "Updated note" },
    );
    const phones = await db.execute("SELECT value FROM candidate_contacts WHERE contact_type='phone'");
    assert.deepEqual(phones.rows.map((row) => row.value), ["9000000000"]);
  } finally {
    db.close();
  }
});
