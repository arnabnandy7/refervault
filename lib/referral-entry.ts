import type { Client } from "@libsql/client";
import { randomInt } from "node:crypto";

export type EntryState = {
  status: "idle" | "error" | "success";
  message: string;
  errors: Record<string, string>;
  values?: Record<string, string>;
  attempt?: number;
};

export const initialEntryState: EntryState = {
  status: "idle",
  message: "",
  errors: {},
};

const text = (form: FormData, name: string, max = 500) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
};
const entryFields = [
  "candidateName", "dob", "originalEmails", "mobileNumbers", "experience",
  "skillset", "currentLocation", "preferredLocation", "noticePeriod",
  "linkedin", "referredEmail", "referredDate", "statusCode", "referredTo",
  "company", "jobCodes", "poc", "remarks",
];
export const submittedEntryValues = (form: FormData) =>
  Object.fromEntries(entryFields.map((name) => [name, text(form, name, 3000)]));

const nullable = (value: string) => value || null;
const id = () => randomInt(1, 281_474_976_710_655);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validDate(value: string) {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    year >= 1 &&
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function list(value: string) {
  return [
    ...new Set(
      value
        .split(/[,;\n]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export async function createReferralEntry(
  db: Client,
  form: FormData,
): Promise<EntryState> {
  const submittedValues = submittedEntryValues(form);
  const value = {
    candidateName: text(form, "candidateName", 200),
    dob: text(form, "dob", 10),
    referredEmail: text(form, "referredEmail", 254).toLowerCase(),
    originalEmails: list(text(form, "originalEmails", 1000)).map((email) =>
      email.toLowerCase(),
    ),
    mobileNumbers: list(text(form, "mobileNumbers", 500)),
    experience: text(form, "experience", 50),
    skillset: text(form, "skillset", 1000),
    referredDate: text(form, "referredDate", 10),
    statusCode: text(form, "statusCode", 80) || "unknown",
    referredTo: text(form, "referredTo", 200),
    company: text(form, "company", 200),
    currentLocation: text(form, "currentLocation", 200),
    preferredLocation: text(form, "preferredLocation", 500),
    noticePeriod: text(form, "noticePeriod", 300),
    remarks: text(form, "remarks", 3000),
    jobCodes: list(text(form, "jobCodes", 1000)),
    poc: text(form, "poc", 300),
    linkedin: text(form, "linkedin", 500),
  };

  const errors: Record<string, string> = {};
  if (!value.candidateName)
    errors.candidateName = "Candidate name is required.";
  if (value.dob && !validDate(value.dob))
    errors.dob = "Enter a valid date of birth.";
  if (value.referredDate && !validDate(value.referredDate))
    errors.referredDate = "Enter a valid referral date.";
  if (value.referredEmail && !emailPattern.test(value.referredEmail))
    errors.referredEmail = "Enter a valid referred email.";
  if (value.originalEmails.some((email) => !emailPattern.test(email)))
    errors.originalEmails = "Check the original email addresses.";
  if (value.jobCodes.length && !value.company)
    errors.company = "Company is required when a job code is provided.";
  if (value.linkedin) {
    try {
      const url = new URL(
        value.linkedin.startsWith("http")
          ? value.linkedin
          : `https://${value.linkedin}`,
      );
      if (!url.hostname.endsWith("linkedin.com")) throw new Error();
      value.linkedin = url.toString();
    } catch {
      errors.linkedin = "Enter a valid LinkedIn profile URL.";
    }
  }
  if (Object.keys(errors).length)
    return {
      status: "error",
      message: "Please review the highlighted fields.",
      errors,
      values: submittedValues,
    };

  const contacts = [
    ...value.originalEmails.map((contact) => ({
      type: "email",
      value: contact,
    })),
    ...value.mobileNumbers.map((contact) => ({
      type: "phone",
      value: contact,
    })),
  ];
  let existingCandidateId: number | null = null;
  let existingCandidateName = "";
  if (contacts.length) {
    const placeholders = contacts.map(() => "?").join(",");
    const matches = await db.execute({
      sql: `SELECT DISTINCT c.id, c.name FROM candidate_contacts cc JOIN candidates c ON c.id = cc.candidate_id WHERE lower(cc.value) IN (${placeholders})`,
      args: contacts.map((contact) => contact.value.toLowerCase()),
    });
    if (matches.rows.length > 1) {
      return {
        status: "error",
        message:
          "The supplied contacts match more than one candidate. Review the email addresses and phone numbers.",
        errors: {},
        values: submittedValues,
      };
    }
    if (matches.rows[0]) {
      existingCandidateId = Number(matches.rows[0].id);
      existingCandidateName = String(matches.rows[0].name);
    }
  }

  const candidateId = existingCandidateId ?? id();
  const referralIds = Array.from(
    { length: Math.max(value.jobCodes.length, 1) },
    id,
  );
  const pocId = id();
  const rawValues = {
    "Candidate Name": value.candidateName,
    DOB: value.dob,
    "Referred Email ID": value.referredEmail,
    "Original Email ID": value.originalEmails.join(", "),
    "Mobile No": value.mobileNumbers.join(", "),
    Experience: value.experience,
    Skillset: value.skillset,
    "Referred Date": value.referredDate,
    Status: value.statusCode,
    "Referred To": value.referredTo,
    Company: value.company,
    "Current Location": value.currentLocation,
    "Preferred Location": value.preferredLocation,
    "Notice Period (Days)": value.noticePeriod,
    Remarks: value.remarks,
    "Job Code": value.jobCodes.join(", "),
    PoC: value.poc,
    LinkedIn: value.linkedin,
  };

  const statements = [
    ...(existingCandidateId
      ? []
      : [
          {
            sql: "INSERT INTO candidates (id, name, dob, linkedin_url, current_location, preferred_locations, skillset, experience_raw, availability_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            args: [
              candidateId,
              value.candidateName,
              nullable(value.dob),
              nullable(value.linkedin),
              nullable(value.currentLocation),
              nullable(value.preferredLocation),
              nullable(value.skillset),
              nullable(value.experience),
              nullable(value.noticePeriod),
            ],
          },
        ]),
    ...contacts.map((contact, index) => ({
      sql: "INSERT OR IGNORE INTO candidate_contacts (id, candidate_id, contact_type, value, is_primary) VALUES (?, ?, ?, ?, ?)",
      args: [
        id(),
        candidateId,
        contact.type,
        contact.value,
        !existingCandidateId &&
        (index === 0 ||
          (contact.type === "phone" && index === value.originalEmails.length))
          ? 1
          : 0,
      ],
    })),
    ...(value.company
      ? [
          {
            sql: "INSERT INTO companies (name) VALUES (?) ON CONFLICT(name) DO NOTHING",
            args: [value.company],
          },
        ]
      : []),
    ...value.jobCodes.map((jobCode) => ({
      sql: "INSERT INTO jobs (company_id, job_code) SELECT id, ? FROM companies WHERE name = ? COLLATE NOCASE ON CONFLICT(company_id, job_code) DO NOTHING",
      args: [jobCode, value.company],
    })),
    ...(value.poc
      ? [
          {
            sql: "INSERT INTO contacts (id, company_id, raw_label) VALUES (?, (SELECT id FROM companies WHERE name = ? COLLATE NOCASE), ?)",
            args: [pocId, value.company, value.poc],
          },
        ]
      : []),
    ...referralIds.flatMap((referralId, index) => {
      const jobCode = value.jobCodes[index] ?? "";
      return [
        {
          sql: "INSERT INTO referrals (id, candidate_id, company_id, job_id, referred_email, referred_date, status_code, referral_destination, poc_id, skillset_snapshot, experience_raw, notice_period_raw, remarks) VALUES (?, ?, (SELECT id FROM companies WHERE name = ? COLLATE NOCASE), (SELECT j.id FROM jobs j JOIN companies c ON c.id = j.company_id WHERE c.name = ? COLLATE NOCASE AND j.job_code = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          args: [
            referralId,
            candidateId,
            value.company,
            value.company,
            jobCode,
            nullable(value.referredEmail),
            nullable(value.referredDate),
            value.statusCode,
            nullable(value.referredTo),
            value.poc ? pocId : null,
            nullable(value.skillset),
            nullable(value.experience),
            nullable(value.noticePeriod),
            nullable(value.remarks),
          ],
        },
        {
          sql: "INSERT INTO import_rows (source_file, sheet_name, row_number, raw_values_json, candidate_id, referral_id) VALUES ('ReferVault entry form', 'Manual Entry', ?, ?, ?, ?)",
          args: [index + 1, JSON.stringify(rawValues), candidateId, referralId],
        },
      ];
    }),
  ];

  await db.batch(statements, "write");
  const referralLabel =
    referralIds.length === 1
      ? "referral was"
      : `${referralIds.length} referrals were`;
  return {
    status: "success",
    message: `${existingCandidateName || value.candidateName} and ${referralLabel} saved.`,
    errors: {},
  };
}

export async function updateReferralEntry(
  db: Client,
  referralId: number,
  form: FormData,
): Promise<EntryState> {
  const submittedValues = submittedEntryValues(form);
  const value = {
    candidateName: text(form, "candidateName", 200),
    dob: text(form, "dob", 10),
    referredEmail: text(form, "referredEmail", 254).toLowerCase(),
    originalEmails: list(text(form, "originalEmails", 1000)).map((email) => email.toLowerCase()),
    mobileNumbers: list(text(form, "mobileNumbers", 500)),
    experience: text(form, "experience", 50),
    skillset: text(form, "skillset", 1000),
    referredDate: text(form, "referredDate", 10),
    statusCode: text(form, "statusCode", 80) || "unknown",
    referredTo: text(form, "referredTo", 200),
    company: text(form, "company", 200),
    currentLocation: text(form, "currentLocation", 200),
    preferredLocation: text(form, "preferredLocation", 500),
    noticePeriod: text(form, "noticePeriod", 300),
    remarks: text(form, "remarks", 3000),
    jobCodes: list(text(form, "jobCodes", 1000)),
    poc: text(form, "poc", 300),
    linkedin: text(form, "linkedin", 500),
  };
  const errors: Record<string, string> = {};
  if (!value.candidateName) errors.candidateName = "Candidate name is required.";
  if (value.dob && !validDate(value.dob)) errors.dob = "Enter a valid date of birth.";
  if (value.referredDate && !validDate(value.referredDate)) errors.referredDate = "Enter a valid referral date.";
  if (value.referredEmail && !emailPattern.test(value.referredEmail)) errors.referredEmail = "Enter a valid referred email.";
  if (value.originalEmails.some((email) => !emailPattern.test(email))) errors.originalEmails = "Check the original email addresses.";
  if (value.jobCodes.length > 1) errors.jobCodes = "An existing referral can have one job ID.";
  if (value.jobCodes.length && !value.company) errors.company = "Company is required when a job code is provided.";
  if (value.linkedin) {
    try {
      const url = new URL(value.linkedin.startsWith("http") ? value.linkedin : `https://${value.linkedin}`);
      if (!url.hostname.endsWith("linkedin.com")) throw new Error();
      value.linkedin = url.toString();
    } catch {
      errors.linkedin = "Enter a valid LinkedIn profile URL.";
    }
  }
  if (Object.keys(errors).length)
    return { status: "error", message: "Please review the highlighted fields.", errors, values: submittedValues };

  const existing = await db.execute({
    sql: "SELECT r.candidate_id, r.poc_id, COALESCE(p.raw_label,p.name,p.external_id) poc_label FROM referrals r LEFT JOIN contacts p ON p.id=r.poc_id WHERE r.id = ?",
    args: [referralId],
  });
  if (!existing.rows[0])
    return { status: "error", message: "The referral no longer exists.", errors: {}, values: submittedValues };
  const candidateId = Number(existing.rows[0].candidate_id);
  const existingPocId = existing.rows[0].poc_id == null ? null : Number(existing.rows[0].poc_id);
  const samePoc = value.poc && value.poc === String(existing.rows[0].poc_label ?? "");
  const pocId = value.poc ? (samePoc ? existingPocId : id()) : null;
  const contacts = [
    ...value.originalEmails.map((item) => ({ type: "email", value: item })),
    ...value.mobileNumbers.map((item) => ({ type: "phone", value: item })),
  ];
  const statements = [
    {
      sql: "UPDATE candidates SET name=?, dob=?, linkedin_url=?, current_location=?, preferred_locations=?, skillset=?, experience_raw=?, availability_notes=? WHERE id=?",
      args: [value.candidateName, nullable(value.dob), nullable(value.linkedin), nullable(value.currentLocation), nullable(value.preferredLocation), nullable(value.skillset), nullable(value.experience), nullable(value.noticePeriod), candidateId],
    },
    { sql: "DELETE FROM candidate_contacts WHERE candidate_id=?", args: [candidateId] },
    ...contacts.map((contact, index) => ({
      sql: "INSERT INTO candidate_contacts (id,candidate_id,contact_type,value,is_primary) VALUES (?,?,?,?,?)",
      args: [id(), candidateId, contact.type, contact.value, index === 0 || (contact.type === "phone" && index === value.originalEmails.length) ? 1 : 0],
    })),
    ...(value.company ? [{
      sql: "INSERT INTO companies (name) VALUES (?) ON CONFLICT(name) DO NOTHING",
      args: [value.company],
    }] : []),
    ...(value.jobCodes[0] ? [{
      sql: "INSERT INTO jobs (company_id,job_code) SELECT id,? FROM companies WHERE name=? COLLATE NOCASE ON CONFLICT(company_id,job_code) DO NOTHING",
      args: [value.jobCodes[0], value.company],
    }] : []),
    ...(value.poc && !samePoc
      ? [{ sql: "INSERT INTO contacts (id,company_id,raw_label) VALUES (?,(SELECT id FROM companies WHERE name=? COLLATE NOCASE),?)", args: [pocId, value.company, value.poc] }]
      : []),
    {
      sql: `UPDATE referrals SET company_id=(SELECT id FROM companies WHERE name=? COLLATE NOCASE),
        job_id=(SELECT j.id FROM jobs j JOIN companies co ON co.id=j.company_id WHERE co.name=? COLLATE NOCASE AND j.job_code=?),
        referred_email=?, referred_date=?, status_code=?, referral_destination=?, poc_id=?, skillset_snapshot=?,
        experience_raw=?, notice_period_raw=?, remarks=? WHERE id=?`,
      args: [value.company, value.company, value.jobCodes[0] ?? "", nullable(value.referredEmail), nullable(value.referredDate), value.statusCode, nullable(value.referredTo), pocId, nullable(value.skillset), nullable(value.experience), nullable(value.noticePeriod), nullable(value.remarks), referralId],
    },
  ];
  await db.batch(statements, "write");
  return { status: "success", message: "Candidate and referral information updated.", errors: {} };
}
