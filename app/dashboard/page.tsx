import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/login/actions";
import { Brand } from "@/components/brand";
import { DashboardSearch } from "@/components/dashboard-search";
import { database } from "@/lib/db";
import { isReferralColumn, type ReferralColumnKey } from "@/lib/referral-columns";
import { parseReferralFilters, searchReferrals } from "@/lib/referral-search";
import { getAdmin } from "@/lib/session";

export default async function Dashboard() {
  const admin = await getAdmin();
  if (!admin) redirect("/login");
  const db = database();
  const filters = parseReferralFilters({});
  const [results, statusesResult, preferenceResult] = await Promise.all([
    searchReferrals(db, filters),
    db.execute("SELECT code, label FROM referral_statuses ORDER BY label COLLATE NOCASE"),
    db.execute({
      sql: "SELECT columns_json FROM admin_dashboard_preferences WHERE admin_id = ?",
      args: [admin.id],
    }),
  ]);
  const storedColumns: unknown = preferenceResult.rows[0]
    ? JSON.parse(String(preferenceResult.rows[0].columns_json))
    : null;
  const initialColumns: ReferralColumnKey[] | null =
    Array.isArray(storedColumns) && storedColumns.length > 0 &&
    storedColumns.every((column) => typeof column === "string" && isReferralColumn(column))
      ? [...new Set(storedColumns)]
      : null;
  const statuses = statusesResult.rows.map((status) => ({
    code: String(status.code),
    label: String(status.label),
  }));

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Brand />
        <div className="dashboard-header-actions">
          <Link className="dashboard-add dashboard-statistics" href="/statistics">Statistics</Link>
          <Link className="dashboard-add" href="/referrals/new">Add referral <span aria-hidden="true">+</span></Link>
          <form action={logout}><button className="logout-button">Sign out ↗</button></form>
        </div>
      </header>
      <section className="dashboard-intro">
        <span className="eyebrow">REFERRAL INDEX</span>
        <h1>Find every referral.</h1>
        <p>Search candidates and the jobs they were referred for.</p>
      </section>
      <DashboardSearch initialResult={{ ...results, filters }} statuses={statuses} initialColumns={initialColumns} />
    </main>
  );
}
