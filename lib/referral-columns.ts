export const REFERRAL_COLUMNS = [
  { key: "candidateName", label: "Candidate name" },
  { key: "referredEmail", label: "Refer email" },
  { key: "referralDate", label: "Refer date" },
  { key: "jobId", label: "Job ID" },
  { key: "originalEmails", label: "Original email ID" },
  { key: "mobileNumbers", label: "Mobile No" },
  { key: "experience", label: "Experience" },
  { key: "company", label: "Company" },
  { key: "status", label: "Status" },
  { key: "referredTo", label: "Referred To" },
  { key: "currentLocation", label: "Current Location" },
  { key: "preferredLocation", label: "Preferred Location" },
  { key: "noticePeriod", label: "Notice Period (Days)" },
  { key: "remarks", label: "Remarks" },
  { key: "poc", label: "PoC" },
  { key: "skillset", label: "Skillset" },
  { key: "linkedin", label: "LinkedIn" },
] as const;

export type ReferralColumnKey = (typeof REFERRAL_COLUMNS)[number]["key"];

export function isReferralColumn(value: string): value is ReferralColumnKey {
  return REFERRAL_COLUMNS.some((column) => column.key === value);
}
