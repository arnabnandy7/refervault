import { createHash } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { loadEnvFile } from "node:process";
import { spawnSync } from "node:child_process";
import {
  createClient,
  type InStatement,
  type Transaction,
} from "@libsql/client";

type Row = { row: number; values: Record<string, string> };
type Extract = { sheet: string; date1904: boolean; rows: Row[] };
type PreparedRow = Row & {
  candidateId: number;
  candidateName: string;
  emails: string[];
  phones: string[];
  jobCodes: string[];
  referredDate: string | null;
  statusCode: string;
  company: string | null;
};

const columns = {
  name: "A",
  referredEmail: "B",
  originalEmail: "C",
  mobile: "D",
  experience: "E",
  skillset: "F",
  referredDate: "G",
  status: "H",
  referredTo: "I",
  currentLocation: "J",
  preferredLocation: "K",
  noticePeriod: "L",
  remarks: "M",
  jobCode: "N",
  poc: "O",
  linkedin: "P",
} as const;
const expectedHeaders: Record<string, string> = {
  A: "Candidate Name",
  B: "Referred Email ID",
  C: "Original Email ID",
  D: "Mobile No",
  E: "Experience",
  F: "Skillset",
  G: "Referred Date",
  H: "Status",
  I: "Referred To",
  J: "Current Location",
  K: "Preferred Location",
  L: "Notice Period (Days)",
  M: "Remarks",
  N: "Job Code",
  O: "PoC",
  P: "LinkedIn",
};
const clean = (value?: string) => value?.trim() || "";
const nullable = (value?: string) => clean(value) || null;
const split = (value?: string) => [
  ...new Set(
    clean(value)
      .split(/[,;\n]+/)
      .map(clean)
      .filter(Boolean),
  ),
];
const jobIds = (value?: string) =>
  split(value)
    .map((jobId) => jobId.replace(/[\u0000-\u001f\u007f\ufffd\s]/g, ""))
    .filter(Boolean);
const numericId = (namespace: string, value: string) =>
  Number.parseInt(
    createHash("sha256")
      .update(`${namespace}:${value}`)
      .digest("hex")
      .slice(0, 12),
    16,
  ) || 1;

function excelDate(raw: string, date1904: boolean) {
  const value = clean(raw);
  if (!value || value.toUpperCase() === "NA") return null;
  if (/^\d+(\.\d+)?$/.test(value)) {
    const epoch = Date.UTC(
      date1904 ? 1904 : 1899,
      date1904 ? 0 : 11,
      date1904 ? 1 : 30,
    );
    return new Date(epoch + Math.floor(Number(value)) * 86_400_000)
      .toISOString()
      .slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  throw new Error("Workbook contains an unsupported referral date format.");
}

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function companyFor(
  row: Row,
  jobCodes: string[],
  companyMap: Record<string, string>,
) {
  const destination = clean(row.values[columns.referredTo]).toLowerCase();
  const company =
    companyMap[destination] ??
    (jobCodes.length ? companyMap["*job-id"] : undefined);
  return nullable(company);
}

async function inChunks(
  transaction: Transaction,
  statements: InStatement[],
  size = 150,
) {
  for (let index = 0; index < statements.length; index += size) {
    await transaction.batch(statements.slice(index, index + size));
  }
}

async function main() {
  const workbookPath = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!workbookPath)
    throw new Error(
      "Usage: npm run import:excel -- <workbook.xlsm> [--company-map companies.json] [--candidate-map candidates.json] [--apply]",
    );
  const companyMapPath = option("--company-map");
  const companyMap = companyMapPath
    ? (JSON.parse(await readFile(companyMapPath, "utf8")) as Record<
        string,
        string
      >)
    : {};
  const normalizedCompanyMap = Object.fromEntries(
    Object.entries(companyMap).map(([key, company]) => [
      key.trim().toLowerCase(),
      clean(company),
    ]),
  );
  const candidateMapPath = option("--candidate-map");
  const candidateMap = candidateMapPath
    ? (JSON.parse(await readFile(candidateMapPath, "utf8")) as Record<
        string,
        string
      >)
    : {};
  const normalizedCandidateMap = Object.fromEntries(
    Object.entries(candidateMap).map(([name, identity]) => [
      name.trim().toLowerCase(),
      identity.trim().toLowerCase(),
    ]),
  );
  const candidateNames = Object.fromEntries(
    Object.entries(candidateMap).map(([name, identity]) => [
      name.trim().toLowerCase(),
      identity.trim(),
    ]),
  );
  loadEnvFile(".env.production.local");
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN)
    throw new Error("Production Turso credentials are missing.");

  const bytes = await readFile(workbookPath);
  const fingerprint = createHash("sha256").update(bytes).digest("hex");
  const source = `${basename(workbookPath)}#sha256=${fingerprint}`;
  const temporary = join(
    tmpdir(),
    `refervault-${fingerprint.slice(0, 12)}.xlsm`,
  );
  await writeFile(temporary, bytes);
  let extracted: Extract;
  try {
    const result = spawnSync(
      "python",
      [join("scripts", "extract-profile-list.py"), temporary],
      { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
    );
    if (result.status !== 0)
      throw new Error("The Excel workbook could not be extracted.");
    extracted = JSON.parse(result.stdout) as Extract;
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
  if (extracted.sheet !== "ProfileList")
    throw new Error("The second sheet is not ProfileList.");
  const header = extracted.rows.shift();
  if (
    !header ||
    Object.entries(expectedHeaders).some(
      ([column, label]) => clean(header.values[column]) !== label,
    )
  )
    throw new Error(
      "ProfileList headers do not match the expected A:P layout.",
    );

  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  try {
    const statusRows = await db.execute(
      "SELECT code, label FROM referral_statuses",
    );
    const statusByLabel = new Map(
      statusRows.rows.map((row) => [
        String(row.label).trim().toLowerCase(),
        String(row.code),
      ]),
    );
    const parent = new Map<string, string>();
    const find = (key: string): string => {
      const next = parent.get(key);
      if (!next || next === key) return key;
      const root = find(next);
      parent.set(key, root);
      return root;
    };
    const union = (left: string, right: string) => {
      const a = find(left),
        b = find(right);
      if (a !== b) parent.set(b, a);
    };
    const tokensByRow = new Map<number, string[]>();
    const namesByContact = new Map<string, Set<string>>();
    for (const row of extracted.rows) {
      const candidateName = clean(row.values[columns.name]).toLowerCase();
      const candidateIdentity =
        normalizedCandidateMap[candidateName] ?? candidateName;
      const emails = split(row.values[columns.originalEmail]).map(
        (email) => `email:${email.toLowerCase()}`,
      );
      const phones = split(row.values[columns.mobile])
        .map((phone) => `phone:${phone.replace(/\D/g, "")}`)
        .filter((phone) => phone.length > 6);
      const fallback = clean(row.values[columns.referredEmail]);
      const tokens = [
        ...emails,
        ...phones,
        ...(emails.length || phones.length || !fallback
          ? []
          : [`referred:${fallback.toLowerCase()}`]),
      ];
      for (const contact of tokens) {
        const names = namesByContact.get(contact) ?? new Set<string>();
        names.add(candidateName);
        namesByContact.set(contact, names);
      }
      const scopedTokens = tokens.map(
        (token) => `${candidateIdentity}|${token}`,
      );
      for (const token of scopedTokens)
        if (!parent.has(token)) parent.set(token, token);
      for (const token of scopedTokens.slice(1)) union(scopedTokens[0], token);
      tokensByRow.set(row.row, scopedTokens);
    }
    const conflictingContacts = [...namesByContact]
      .filter(
        ([, names]) =>
          names.size > 1 &&
          [...names].some((name) => !(name in normalizedCandidateMap)),
      )
      .map(([contact, names]) => `${contact} (${[...names].join(", ")})`);
    if (conflictingContacts.length)
      throw new Error(
        `Shared contact values require confirmation through --candidate-map: ${conflictingContacts.join("; ")}`,
      );

    const unknownStatuses = new Set<string>();
    const prepared: PreparedRow[] = extracted.rows.map((row) => {
      const tokens = tokensByRow.get(row.row) ?? [];
      const identity = tokens.length ? find(tokens[0]) : `row:${row.row}`;
      const statusLabel = clean(row.values[columns.status]);
      const statusCode = statusLabel
        ? statusByLabel.get(statusLabel.toLowerCase())
        : "unknown";
      if (!statusCode) unknownStatuses.add(statusLabel);
      const jobCodes = jobIds(row.values[columns.jobCode]);
      return {
        ...row,
        candidateId: numericId(fingerprint, `candidate:${identity}`),
        candidateName:
          candidateNames[clean(row.values[columns.name]).toLowerCase()] ??
          clean(row.values[columns.name]),
        emails: split(row.values[columns.originalEmail]).map((email) =>
          email.toLowerCase(),
        ),
        phones: split(row.values[columns.mobile]),
        jobCodes,
        referredDate: excelDate(
          row.values[columns.referredDate],
          extracted.date1904,
        ),
        statusCode: statusCode ?? "unknown",
        company: companyFor(row, jobCodes, normalizedCompanyMap),
      };
    });
    if (unknownStatuses.size)
      throw new Error(
        `Unmapped status labels found: ${[...unknownStatuses].join(", ")}`,
      );
    const unmappedJobRows = prepared
      .filter((row) => row.jobCodes.length && !row.company)
      .map((row) => row.row);
    if (unmappedJobRows.length)
      throw new Error(
        `Rows with job IDs require a confirmed company mapping. Add "*job-id" to --company-map. Rows: ${unmappedJobRows.join(", ")}`,
      );

    const candidateRows = new Map<number, PreparedRow>();
    for (const row of prepared) {
      if (!candidateRows.has(row.candidateId))
        candidateRows.set(row.candidateId, row);
    }
    const referralCount = prepared.reduce(
      (total, row) => total + Math.max(row.jobCodes.length, 1),
      0,
    );
    const existingSource = await db.execute({
      sql: "SELECT count(*) AS count FROM import_rows WHERE source_file = ? AND sheet_name = ?",
      args: [source, extracted.sheet],
    });
    const existing = Number(existingSource.rows[0].count);
    const databaseCounts = await db.execute(
      "SELECT (SELECT count(*) FROM candidates) AS candidates, (SELECT count(*) FROM referrals) AS referrals",
    );
    const currentCandidates = Number(databaseCounts.rows[0].candidates);
    const currentReferrals = Number(databaseCounts.rows[0].referrals);
    console.log(
      JSON.stringify({
        mode: apply ? "apply" : "dry-run",
        fingerprint: fingerprint.slice(0, 12),
        sourceRows: prepared.length,
        candidates: candidateRows.size,
        referrals: referralCount,
        rowsAlreadyImported: existing,
        databaseCandidates: currentCandidates,
        databaseReferrals: currentReferrals,
      }),
    );
    if (!apply) return;
    if (!existing && (currentCandidates || currentReferrals))
      throw new Error(
        "Production already contains unrelated candidate/referral data; import stopped.",
      );

    const transaction = await db.transaction("write");
    try {
      const companies = [
        ...new Set(
          prepared
            .map((row) => row.company)
            .filter((value): value is string => Boolean(value)),
        ),
      ];
      await inChunks(
        transaction,
        companies.map((company) => ({
          sql: "INSERT INTO companies (id, name) VALUES (?, ?) ON CONFLICT(name) DO NOTHING",
          args: [
            numericId(fingerprint, `company:${company.toLowerCase()}`),
            company,
          ],
        })),
      );
      await inChunks(
        transaction,
        [...candidateRows.values()].map((row) => ({
          sql: "INSERT OR IGNORE INTO candidates (id, name) VALUES (?, ?)",
          args: [row.candidateId, row.candidateName],
        })),
      );

      const contactStatements: InStatement[] = [];
      const seenContacts = new Set<string>();
      const primaryContacts = new Set<string>();
      for (const row of prepared) {
        for (const [type, values] of [
          ["email", row.emails],
          ["phone", row.phones],
        ] as const) {
          values.forEach((value, index) => {
            const key = `${row.candidateId}:${type}:${value.toLowerCase()}`;
            if (seenContacts.has(key)) return;
            seenContacts.add(key);
            const primaryKey = `${row.candidateId}:${type}`;
            const isPrimary = !primaryContacts.has(primaryKey);
            primaryContacts.add(primaryKey);
            contactStatements.push({
              sql: "INSERT OR IGNORE INTO candidate_contacts (id, candidate_id, contact_type, value, is_primary) VALUES (?, ?, ?, ?, ?)",
              args: [
                numericId(fingerprint, `candidate-contact:${key}`),
                row.candidateId,
                type,
                value,
                isPrimary ? 1 : 0,
              ],
            });
          });
        }
      }
      await inChunks(transaction, contactStatements);

      const jobStatements = new Map<string, InStatement>();
      const pocStatements = new Map<string, InStatement>();
      for (const row of prepared) {
        for (const jobCode of row.jobCodes) {
          const key = `${row.company}:${jobCode}`;
          jobStatements.set(key, {
            sql: "INSERT OR IGNORE INTO jobs (id, company_id, job_code) VALUES (?, (SELECT id FROM companies WHERE name = ? COLLATE NOCASE), ?)",
            args: [numericId(fingerprint, `job:${key}`), row.company, jobCode],
          });
        }
        const poc = clean(row.values.O);
        if (poc) {
          const key = `${row.company}:${poc}`;
          pocStatements.set(key, {
            sql: "INSERT OR IGNORE INTO contacts (id, company_id, raw_label) VALUES (?, (SELECT id FROM companies WHERE name = ? COLLATE NOCASE), ?)",
            args: [numericId(fingerprint, `poc:${key}`), row.company, poc],
          });
        }
      }
      await inChunks(transaction, [
        ...jobStatements.values(),
        ...pocStatements.values(),
      ]);

      const referralStatements: InStatement[] = [];
      for (const row of prepared) {
        const jobs = row.jobCodes.length ? row.jobCodes : [""];
        jobs.forEach((jobCode, index) => {
          const referralId = numericId(
            fingerprint,
            `referral:${row.row}:${index}:${jobCode}`,
          );
          const poc = clean(row.values.O);
          const pocKey = `${row.company}:${poc}`;
          referralStatements.push({
            sql: "INSERT OR IGNORE INTO referrals (id, candidate_id, company_id, job_id, referred_email, referred_date, status_code, referral_destination, poc_id, skillset_snapshot, experience_raw, notice_period_raw, remarks) VALUES (?, ?, (SELECT id FROM companies WHERE name = ? COLLATE NOCASE), (SELECT j.id FROM jobs j JOIN companies c ON c.id = j.company_id WHERE c.name = ? COLLATE NOCASE AND j.job_code = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            args: [
              referralId,
              row.candidateId,
              row.company,
              row.company,
              jobCode,
              nullable(row.values.B),
              row.referredDate,
              row.statusCode,
              nullable(row.values.I),
              poc ? numericId(fingerprint, `poc:${pocKey}`) : null,
              nullable(row.values.F),
              nullable(row.values.E),
              nullable(row.values.L),
              nullable(row.values.M),
            ],
          });
          referralStatements.push({
            sql: "INSERT OR IGNORE INTO import_rows (id, source_file, sheet_name, row_number, raw_values_json, candidate_id, referral_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
            args: [
              numericId(fingerprint, `import:${row.row}:${index}:${jobCode}`),
              source,
              extracted.sheet,
              row.row,
              JSON.stringify(row.values),
              row.candidateId,
              referralId,
            ],
          });
        });
      }
      await inChunks(transaction, referralStatements, 100);

      const final = await transaction.execute({
        sql: "SELECT (SELECT count(*) FROM candidates) AS candidates, (SELECT count(*) FROM referrals) AS referrals, (SELECT count(*) FROM import_rows WHERE source_file = ?) AS imported, (SELECT count(*) FROM referral_status_history) AS history",
        args: [source],
      });
      const counts = final.rows[0];
      if (
        Number(counts.candidates) !== candidateRows.size ||
        Number(counts.referrals) !== referralCount ||
        Number(counts.imported) !== referralCount ||
        Number(counts.history) !== referralCount
      )
        throw new Error("Post-import row counts do not reconcile.");
      const integrity = await transaction.execute("PRAGMA integrity_check");
      const foreignKeys = await transaction.execute("PRAGMA foreign_key_check");
      const duplicatePrimaries = await transaction.execute(
        "SELECT count(*) AS count FROM (SELECT candidate_id, contact_type FROM candidate_contacts WHERE is_primary = 1 GROUP BY candidate_id, contact_type HAVING count(*) > 1)",
      );
      const blankJobs = await transaction.execute(
        "SELECT count(*) AS count FROM jobs WHERE length(trim(job_code)) = 0",
      );
      if (
        String(integrity.rows[0]?.integrity_check) !== "ok" ||
        foreignKeys.rows.length ||
        Number(duplicatePrimaries.rows[0].count) ||
        Number(blankJobs.rows[0].count)
      )
        throw new Error("Post-import database integrity check failed.");
      await transaction.commit();
      console.log(
        JSON.stringify({
          imported: true,
          candidates: Number(counts.candidates),
          referrals: Number(counts.referrals),
          sourceRows: prepared.length,
          integrity: "ok",
        }),
      );
    } catch (error) {
      if (!transaction.closed) await transaction.rollback();
      throw error;
    } finally {
      transaction.close();
    }
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Import failed.");
  process.exitCode = 1;
});
