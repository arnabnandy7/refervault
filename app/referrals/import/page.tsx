import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { ReferralImportForm } from "@/components/referral-import-form";
import { database } from "@/lib/db";
import { getAdmin } from "@/lib/session";

export default async function ImportReferralsPage() {
  if (!(await getAdmin())) redirect("/login");
  const result = await database().execute(
    "SELECT code, label FROM referral_statuses ORDER BY CASE code WHEN 'unknown' THEN 0 WHEN 'referred' THEN 1 ELSE 2 END, label",
  );
  const statuses = result.rows.map((row) => ({
    code: String(row.code),
    label: String(row.label),
  }));

  return (
    <main className="entry-page">
      <header className="entry-header">
        <Brand />
        <a href="/dashboard">
          Back to workspace <span aria-hidden="true">↗</span>
        </a>
      </header>
      <section className="entry-intro">
        <div className="entry-intro-tools">
          <span className="eyebrow"><span />BULK IMPORT</span>
          <a className="entry-alternative" href="/referrals/new">
            Use manual form <span aria-hidden="true">↗</span>
          </a>
        </div>
        <h1>Import referrals.</h1>
        <p>Start with the template, add your candidates, and upload your workbook.</p>
      </section>
      <ReferralImportForm statuses={statuses} />
    </main>
  );
}
