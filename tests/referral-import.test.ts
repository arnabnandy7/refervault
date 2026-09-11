import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createClient } from "@libsql/client";
import { utils, write, type BookType } from "xlsx";
import { IMPORT_COLUMNS } from "../lib/referral-import-format";
import { importReferralWorkbook, parseReferralWorkbook } from "../lib/referral-import";

function fixture(rows: unknown[][], type: BookType = "xlsx", headers = IMPORT_COLUMNS.map(([label]) => String(label)), date1904 = false) {
  const book = utils.book_new();
  utils.book_append_sheet(book, utils.aoa_to_sheet([headers, ...rows]), "Any sheet name");
  book.Workbook = { WBProps: { date1904 } };
  return write(book, { type: "buffer", bookType: type }) as Uint8Array;
}
const candidate = (name = "Example Candidate") => [name, "referred@example.test", "original@example.test", "0012345678", "5+", "React", 46276, "Referred", "Job Code", "Kolkata", "Remote", "30", "1993-02-28", "Notes", "000123;000456", "Hiring manager", "linkedin.com/in/example"];

test("downloadable original template has the expected headers and no candidate data", async () => {
  const bytes = await readFile("public/templates/Referral_format.xlsx");
  assert.throws(() => parseReferralWorkbook(bytes), /Add at least one candidate/);
});

for (const type of ["xlsx", "xls", "xlsm"] as const) {
  test(`reads ${type} by position, preserving DOB, identifiers and dates`, () => {
    const { rows } = parseReferralWorkbook(fixture([candidate()], type));
    assert.equal(rows[0].form.get("mobileNumbers"), "0012345678");
    assert.equal(rows[0].form.get("jobCodes"), "000123;000456");
    assert.equal(rows[0].form.get("dob"), "1993-02-28");
    assert.equal(rows[0].form.get("referredDate"), "2026-09-11");
    assert.equal(rows[0].form.get("remarks"), "Notes");
  });
}

test("supports different header wording, blank rows, and 1904 dates", () => {
  const row = candidate(); row[6] = 1;
  const parsed = parseReferralWorkbook(fixture([[], row], "xlsx", IMPORT_COLUMNS.map((_, i) => `Field ${i}`), true));
  assert.equal(parsed.rows[0].row, 3);
  assert.equal(parsed.rows[0].form.get("referredDate"), "1904-01-02");
});

test("rejects reordered columns, invalid files, extra data and oversized sheets", () => {
  const headers = IMPORT_COLUMNS.map(([label]) => String(label));
  [headers[12], headers[13]] = [headers[13], headers[12]];
  assert.throws(() => parseReferralWorkbook(fixture([candidate()], "xlsx", headers)), /column order/);
  assert.throws(() => parseReferralWorkbook(new TextEncoder().encode("a,b,c")), /valid/);
  assert.throws(() => parseReferralWorkbook(fixture([[...candidate(), "extra"]])), /extra data/);
  assert.throws(() => parseReferralWorkbook(fixture(Array.from({ length: 201 }, () => candidate()))), /200/);
});

test("imports atomically with form validation, multiple job IDs, and source metadata", async () => {
  const db = createClient({ url: "file::memory:" });
  try {
    await db.executeMultiple(await readFile("db/schema.sql", "utf8"));
    const bad = candidate("Invalid"); bad[1] = "invalid-email";
    await assert.rejects(importReferralWorkbook(db, fixture([candidate(), bad]), "batch.xlsx", "Example Corp"), /Row 3.*email/);
    assert.equal((await db.execute("SELECT * FROM candidates")).rows.length, 0);
    await assert.rejects(importReferralWorkbook(db, fixture([candidate()]), "batch.xlsx", ""), /Company is required/);
    const unknown = candidate(); unknown[7] = "Not a status";
    await assert.rejects(importReferralWorkbook(db, fixture([unknown]), "batch.xlsx", "Example Corp"), /status is not recognized/);
    const count = await importReferralWorkbook(db, fixture([candidate()]), "batch.xlsx", "Example Corp");
    assert.equal(count, 1);
    assert.equal((await db.execute("SELECT * FROM referrals")).rows.length, 2);
    assert.equal((await db.execute("SELECT dob FROM candidates")).rows[0].dob, "1993-02-28");
    const source = (await db.execute("SELECT source_file, sheet_name, row_number FROM import_rows")).rows[0];
    assert.equal(source.source_file, "batch.xlsx");
    assert.equal(source.sheet_name, "Any sheet name");
    assert.equal(source.row_number, 2);
  } finally { db.close(); }
});
