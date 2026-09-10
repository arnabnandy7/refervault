import type { Client } from "@libsql/client";

export const STATISTIC_CATEGORIES = [
  { key: "status", label: "Status", expression: "s.label" },
  { key: "referralMonth", label: "Referral month", expression: "substr(r.referred_date, 1, 7)" },
  { key: "referralYear", label: "Referral year", expression: "substr(r.referred_date, 1, 4)" },
  { key: "referralDate", label: "Referral date", expression: "r.referred_date" },
  { key: "candidateName", label: "Candidate name", expression: "c.name" },
  { key: "referredEmail", label: "Referred email ID", expression: "r.referred_email" },
  {
    key: "originalEmails",
    label: "Original email ID",
    expression:
      "(SELECT GROUP_CONCAT(email.value, ', ') FROM candidate_contacts email WHERE email.candidate_id = c.id AND email.contact_type = 'email')",
  },
  {
    key: "mobileNumbers",
    label: "Mobile No",
    expression:
      "(SELECT GROUP_CONCAT(phone.value, ', ') FROM candidate_contacts phone WHERE phone.candidate_id = c.id AND phone.contact_type = 'phone')",
  },
  { key: "experience", label: "Experience", expression: "COALESCE(r.experience_raw, c.experience_raw)" },
  { key: "skillset", label: "Skillset", expression: "COALESCE(r.skillset_snapshot, c.skillset)" },
  { key: "referredTo", label: "Referred To", expression: "r.referral_destination" },
  { key: "company", label: "Company", expression: "company.name" },
  { key: "currentLocation", label: "Current Location", expression: "c.current_location" },
  { key: "preferredLocation", label: "Preferred Location", expression: "c.preferred_locations" },
  { key: "noticePeriod", label: "Notice Period (Days)", expression: "r.notice_period_raw" },
  { key: "remarks", label: "Remarks", expression: "r.remarks" },
  { key: "jobId", label: "Job ID", expression: "j.job_code" },
  { key: "poc", label: "PoC", expression: "COALESCE(p.raw_label, p.name, p.external_id)" },
  { key: "linkedin", label: "LinkedIn", expression: "c.linkedin_url" },
] as const;

export type StatisticCategory = (typeof STATISTIC_CATEGORIES)[number]["key"];
export type StatisticRow = { label: string; count: number };

export function parseStatisticCategory(value: string | undefined): StatisticCategory {
  return STATISTIC_CATEGORIES.some((category) => category.key === value)
    ? (value as StatisticCategory)
    : "status";
}

export function parseStatisticLimit(value: string | undefined) {
  const limit = Number(value);
  return limit === 10 || limit === 25 || limit === 50 ? limit : 10;
}

export async function referralStatistics(
  db: Client,
  categoryKey: StatisticCategory,
  limit: number,
) {
  const category = STATISTIC_CATEGORIES.find(({ key }) => key === categoryKey)!;
  const result = await db.execute({
    sql: `WITH categorized AS (
      SELECT COALESCE(NULLIF(trim(${category.expression}), ''), 'Not specified') AS category
      FROM referrals r
      JOIN candidates c ON c.id = r.candidate_id
      JOIN referral_statuses s ON s.code = r.status_code
      LEFT JOIN jobs j ON j.id = r.job_id
      LEFT JOIN companies company ON company.id = r.company_id
      LEFT JOIN contacts p ON p.id = r.poc_id
    )
    SELECT category, COUNT(*) AS total
    FROM categorized
    GROUP BY category
    ORDER BY total DESC, category COLLATE NOCASE
    LIMIT ?`,
    args: [limit],
  });
  return result.rows.map((row) => ({
    label: String(row.category),
    count: Number(row.total),
  })) satisfies StatisticRow[];
}
