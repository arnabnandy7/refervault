import { notFound, redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { ReferralEntryForm, type ReferralFormValues } from "@/components/referral-entry-form";
import { database } from "@/lib/db";
import { getAdmin } from "@/lib/session";
import { updateReferral } from "./actions";

export default async function EditReferralPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdmin())) redirect("/login");
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const db = database();
  const [result, statuses] = await Promise.all([
    db.execute({
      sql: `SELECT c.name, c.dob, c.linkedin_url, c.current_location, c.preferred_locations,
        c.skillset, c.experience_raw AS candidate_experience, c.availability_notes,
        (SELECT GROUP_CONCAT(value, ', ') FROM candidate_contacts WHERE candidate_id=c.id AND contact_type='email') original_emails,
        (SELECT GROUP_CONCAT(value, ', ') FROM candidate_contacts WHERE candidate_id=c.id AND contact_type='phone') mobile_numbers,
        r.referred_email, r.referred_date, r.status_code, r.referral_destination,
        r.skillset_snapshot, r.experience_raw, r.notice_period_raw, r.remarks,
        company.name company_name, j.job_code, COALESCE(p.raw_label,p.name,p.external_id) poc
        FROM referrals r JOIN candidates c ON c.id=r.candidate_id
        LEFT JOIN companies company ON company.id=r.company_id LEFT JOIN jobs j ON j.id=r.job_id
        LEFT JOIN contacts p ON p.id=r.poc_id WHERE r.id=?`,
      args: [id],
    }),
    db.execute("SELECT code, label FROM referral_statuses ORDER BY CASE code WHEN 'unknown' THEN 0 WHEN 'referred' THEN 1 ELSE 2 END, label"),
  ]);
  const row = result.rows[0];
  if (!row) notFound();
  const string = (value: unknown) => value == null ? "" : String(value);
  const values: ReferralFormValues = {
    candidateName: string(row.name), dob: string(row.dob), originalEmails: string(row.original_emails),
    mobileNumbers: string(row.mobile_numbers), experience: string(row.experience_raw ?? row.candidate_experience),
    skillset: string(row.skillset_snapshot ?? row.skillset), currentLocation: string(row.current_location),
    preferredLocation: string(row.preferred_locations), noticePeriod: string(row.notice_period_raw ?? row.availability_notes),
    linkedin: string(row.linkedin_url), referredEmail: string(row.referred_email), referredDate: string(row.referred_date),
    statusCode: string(row.status_code), referredTo: string(row.referral_destination), company: string(row.company_name),
    jobCodes: string(row.job_code), poc: string(row.poc), remarks: string(row.remarks),
  };
  return <main className="entry-page"><header className="entry-header"><Brand /><a href="/dashboard">Back to workspace <span>↗</span></a></header>
    <section className="entry-intro"><span className="eyebrow">EDIT REFERRAL</span><h1>Update information.</h1><p>Candidate profile changes apply to every referral for this candidate.</p></section>
    <ReferralEntryForm statuses={statuses.rows.map((s) => ({code:String(s.code),label:String(s.label)}))} initialValues={values} submitAction={updateReferral.bind(null,id)} mode="edit" />
  </main>;
}
