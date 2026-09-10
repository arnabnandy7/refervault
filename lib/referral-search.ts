import type { Client } from "@libsql/client";

export const REFERRALS_PER_PAGE = 25;
export type RawSearchParams = Record<string, string | string[] | undefined>;
export type ReferralFilters = {
  dateFrom: string;
  dateTo: string;
  candidateName: string;
  jobId: string;
  originalEmail: string;
  referredEmail: string;
  status: string;
  poc: string;
  skillset: string;
  page: number;
};
export type ReferralSearchRow = {
  id: number;
  candidateName: string;
  jobId: string | null;
  company: string | null;
  originalEmails: string | null;
  mobileNumbers: string | null;
  referredEmail: string | null;
  referralDate: string | null;
  experience: string | null;
  statusCode: string;
  status: string;
  referredTo: string | null;
  currentLocation: string | null;
  preferredLocation: string | null;
  noticePeriod: string | null;
  remarks: string | null;
  poc: string | null;
  skillset: string | null;
  linkedin: string | null;
};

const value = (raw: RawSearchParams, key: string) => {
  const input = raw[key];
  return (Array.isArray(input) ? input[0] : input)?.trim() ?? "";
};
const validDate = (input: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return "";
  const [year, month, day] = input.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? input
    : "";
};
export function parseReferralFilters(raw: RawSearchParams): ReferralFilters {
  const page = Number.parseInt(value(raw, "page"), 10);
  return {
    dateFrom: validDate(value(raw, "dateFrom")),
    dateTo: validDate(value(raw, "dateTo")),
    candidateName: value(raw, "candidateName"),
    jobId: value(raw, "jobId"),
    originalEmail: value(raw, "originalEmail"),
    referredEmail: value(raw, "referredEmail"),
    status: value(raw, "status"),
    poc: value(raw, "poc"),
    skillset: value(raw, "skillset"),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}
function like(input: string) {
  return `%${input.replace(/[\\%_]/g, "\\$&")}%`;
}

function buildReferralQuery(filters: ReferralFilters) {
  const clauses: string[] = [];
  const args: string[] = [];
  const addLike = (sql: string, input: string) => {
    if (input) {
      clauses.push(sql);
      args.push(like(input));
    }
  };
  if (filters.dateFrom) {
    clauses.push("r.referred_date >= ?");
    args.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    clauses.push("r.referred_date <= ?");
    args.push(filters.dateTo);
  }
  addLike("c.name LIKE ? ESCAPE '\\' COLLATE NOCASE", filters.candidateName);
  addLike("j.job_code LIKE ? ESCAPE '\\' COLLATE NOCASE", filters.jobId);
  if (filters.originalEmail) {
    clauses.push(
      "EXISTS (SELECT 1 FROM candidate_contacts searched_email WHERE searched_email.candidate_id = c.id AND searched_email.contact_type = 'email' AND searched_email.value LIKE ? ESCAPE '\\' COLLATE NOCASE)",
    );
    args.push(like(filters.originalEmail));
  }
  addLike(
    "r.referred_email LIKE ? ESCAPE '\\' COLLATE NOCASE",
    filters.referredEmail,
  );
  if (filters.status) {
    clauses.push("r.status_code = ?");
    args.push(filters.status);
  }
  addLike(
    "COALESCE(p.raw_label, p.name, p.external_id, '') LIKE ? ESCAPE '\\' COLLATE NOCASE",
    filters.poc,
  );
  addLike(
    "COALESCE(r.skillset_snapshot, c.skillset, '') LIKE ? ESCAPE '\\' COLLATE NOCASE",
    filters.skillset,
  );

  const from =
    "FROM referrals r JOIN candidates c ON c.id = r.candidate_id JOIN referral_statuses s ON s.code = r.status_code LEFT JOIN jobs j ON j.id = r.job_id LEFT JOIN companies company ON company.id = r.company_id LEFT JOIN contacts p ON p.id = r.poc_id";
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return { from, where, args };
}

const select = `SELECT r.id, c.name AS candidate_name, j.job_code, company.name AS company_name,
  (SELECT GROUP_CONCAT(email.value, ', ') FROM candidate_contacts email WHERE email.candidate_id = c.id AND email.contact_type = 'email') AS original_emails,
  (SELECT GROUP_CONCAT(phone.value, ', ') FROM candidate_contacts phone WHERE phone.candidate_id = c.id AND phone.contact_type = 'phone') AS mobile_numbers,
  r.referred_email, r.referred_date, r.status_code, s.label AS status_label,
  r.referral_destination, c.current_location, c.preferred_locations,
  r.notice_period_raw, r.remarks, c.linkedin_url,
  COALESCE(p.raw_label, p.name, p.external_id) AS poc,
  COALESCE(r.skillset_snapshot, c.skillset) AS skillset,
  COALESCE(r.experience_raw, c.experience_raw) AS experience`;

function mapRows(rows: Awaited<ReturnType<Client["execute"]>>["rows"]) {
  return rows.map((row) => ({
    id: Number(row.id),
    candidateName: String(row.candidate_name),
    jobId: row.job_code == null ? null : String(row.job_code),
    company: row.company_name == null ? null : String(row.company_name),
    originalEmails:
      row.original_emails == null ? null : String(row.original_emails),
    mobileNumbers:
      row.mobile_numbers == null ? null : String(row.mobile_numbers),
    referredEmail:
      row.referred_email == null ? null : String(row.referred_email),
    referralDate: row.referred_date == null ? null : String(row.referred_date),
    experience: row.experience == null ? null : String(row.experience),
    statusCode: String(row.status_code),
    status: String(row.status_label),
    referredTo:
      row.referral_destination == null
        ? null
        : String(row.referral_destination),
    currentLocation:
      row.current_location == null ? null : String(row.current_location),
    preferredLocation:
      row.preferred_locations == null
        ? null
        : String(row.preferred_locations),
    noticePeriod:
      row.notice_period_raw == null ? null : String(row.notice_period_raw),
    remarks: row.remarks == null ? null : String(row.remarks),
    poc: row.poc == null ? null : String(row.poc),
    skillset: row.skillset == null ? null : String(row.skillset),
    linkedin: row.linkedin_url == null ? null : String(row.linkedin_url),
  })) satisfies ReferralSearchRow[];
}

export async function searchReferrals(db: Client, filters: ReferralFilters) {
  const { from, where, args } = buildReferralQuery(filters);
  const requestedOffset = (filters.page - 1) * REFERRALS_PER_PAGE;
  const [countResult, initialResult] = await db.batch(
    [
      { sql: `SELECT COUNT(*) AS total ${from} ${where}`, args },
      {
        sql: `${select} ${from} ${where}
          ORDER BY r.referred_date DESC NULLS LAST, r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`,
        args: [...args, REFERRALS_PER_PAGE, requestedOffset],
      },
    ],
    "read",
  );
  const total = Number(countResult.rows[0]?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / REFERRALS_PER_PAGE));
  const page = Math.min(filters.page, pageCount);
  const result =
    page === filters.page
      ? initialResult
      : await db.execute({
          sql: `${select} ${from} ${where}
            ORDER BY r.referred_date DESC NULLS LAST, r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`,
          args: [...args, REFERRALS_PER_PAGE, (page - 1) * REFERRALS_PER_PAGE],
        });
  const rows = mapRows(result.rows);
  return { rows, total, page, pageCount };
}

export async function exportReferrals(db: Client, filters: ReferralFilters) {
  const { from, where, args } = buildReferralQuery(filters);
  const result = await db.execute({
    sql: `${select} ${from} ${where} ORDER BY r.referred_date DESC NULLS LAST, r.created_at DESC, r.id DESC`,
    args,
  });
  return mapRows(result.rows);
}
