import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { ReferralEntryForm } from "@/components/referral-entry-form";
import { ReferralImportForm } from "@/components/referral-import-form";
import { database } from "@/lib/db";
import { getAdmin } from "@/lib/session";

export default async function NewReferralPage() {
  if (!(await getAdmin())) redirect("/login");
  const result = await database().execute(
    "SELECT code, label FROM referral_statuses ORDER BY CASE code WHEN 'unknown' THEN 0 WHEN 'referred' THEN 1 ELSE 2 END, label",
  );
  const statuses = result.rows.map((row) => ({
    code: String(row.code),
    label: String(row.label),
  }));
  const todayParts = Object.fromEntries(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  const currentDate = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
  return (
    <main className="entry-page">
      <header className="entry-header">
        <Brand />
        <a href="/dashboard">
          Back to workspace <span aria-hidden="true">↗</span>
        </a>
      </header>
      <section className="entry-intro">
        <span className="eyebrow">
          <span />
          NEW CONNECTION
        </span>
        <h1>Add a referral.</h1>
        <p>
          Capture the person, the opportunity, and the next step in one place.
        </p>
      </section>
      <ReferralImportForm statuses={statuses} />
      <p className="manual-entry-label">Or add a referral manually</p>
      <ReferralEntryForm
        statuses={statuses}
        initialValues={{ referredDate: currentDate }}
      />
    </main>
  );
}
