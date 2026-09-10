import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/login/actions";
import { Brand } from "@/components/brand";
import { ReferralResults } from "@/components/referral-results";
import { DateFilterPicker } from "@/components/date-filter-picker";
import { database } from "@/lib/db";
import {
  isReferralColumn,
  type ReferralColumnKey,
} from "@/lib/referral-columns";
import {
  REFERRALS_PER_PAGE,
  parseReferralFilters,
  searchReferrals,
  type RawSearchParams,
} from "@/lib/referral-search";
import { getAdmin } from "@/lib/session";

function pageHref(
  filters: ReturnType<typeof parseReferralFilters>,
  page: number,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page })) {
    if (value && !(key === "page" && value === 1))
      params.set(key, String(value));
  }
  return `/dashboard?${params.toString()}`;
}

function filterQuery(filters: ReturnType<typeof parseReferralFilters>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (key !== "page" && value) params.set(key, String(value));
  }
  return params.toString();
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const admin = await getAdmin();
  if (!admin) redirect("/login");
  const filters = parseReferralFilters(await searchParams);
  const db = database();
  const [results, statusesResult, preferenceResult] = await Promise.all([
    searchReferrals(db, filters),
    db.execute(
      "SELECT code, label FROM referral_statuses ORDER BY label COLLATE NOCASE",
    ),
    db.execute({
      sql: "SELECT columns_json FROM admin_dashboard_preferences WHERE admin_id = ?",
      args: [admin.id],
    }),
  ]);
  const storedColumns: unknown = preferenceResult.rows[0]
    ? JSON.parse(String(preferenceResult.rows[0].columns_json))
    : null;
  const initialColumns: ReferralColumnKey[] | null =
    Array.isArray(storedColumns) &&
    storedColumns.length > 0 &&
    storedColumns.every(
      (column) => typeof column === "string" && isReferralColumn(column),
    )
      ? [...new Set(storedColumns)]
      : null;

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Brand />
        <div className="dashboard-header-actions">
          <Link className="dashboard-add" href="/referrals/new">
            Add referral <span aria-hidden="true">+</span>
          </Link>
          <form action={logout}>
            <button className="logout-button">Sign out ↗</button>
          </form>
        </div>
      </header>
      <section className="dashboard-intro">
        <span className="eyebrow">REFERRAL INDEX</span>
        <h1>Find every referral.</h1>
        <p>Search candidates and the jobs they were referred for.</p>
      </section>
      <form className="search-panel" method="get">
        <div className="search-grid">
          <DateFilterPicker
            label="Referral date from"
            name="dateFrom"
            defaultValue={filters.dateFrom}
          />
          <DateFilterPicker
            label="Referral date to"
            name="dateTo"
            defaultValue={filters.dateTo}
          />
          <label>
            <span>Candidate name</span>
            <input
              name="candidateName"
              defaultValue={filters.candidateName}
              placeholder="e.g. Priya Sharma"
            />
          </label>
          <label>
            <span>Job ID</span>
            <input
              name="jobId"
              defaultValue={filters.jobId}
              placeholder="e.g. 123456"
            />
          </label>
          <label>
            <span>Original email ID</span>
            <input
              type="email"
              name="originalEmail"
              defaultValue={filters.originalEmail}
              placeholder="candidate@example.com"
            />
          </label>
          <label>
            <span>Refer email ID</span>
            <input
              type="email"
              name="referredEmail"
              defaultValue={filters.referredEmail}
              placeholder="candidate+ref@example.com"
            />
          </label>
          <label>
            <span>Status</span>
            <select name="status" defaultValue={filters.status}>
              <option value="">All statuses</option>
              {statusesResult.rows.map((status) => (
                <option key={String(status.code)} value={String(status.code)}>
                  {String(status.label)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>PoC</span>
            <input
              name="poc"
              defaultValue={filters.poc}
              placeholder="Name or reference"
            />
          </label>
          <label className="search-skill">
            <span>Skillset</span>
            <input
              name="skillset"
              defaultValue={filters.skillset}
              placeholder="e.g. Java, React"
            />
          </label>
        </div>
        <div className="search-actions">
          <Link href="/dashboard">Clear filters</Link>
          <button type="submit">Search referrals</button>
        </div>
      </form>
      <section className="results-panel" aria-live="polite">
        <div className="results-heading">
          <div>
            <span className="eyebrow">RESULTS</span>
            <h2>
              {results.total.toLocaleString()} referral
              {results.total === 1 ? "" : "s"}
            </h2>
          </div>
          {results.total > 0 && (
            <p>
              Page {results.page} of {results.pageCount}
            </p>
          )}
        </div>
        <ReferralResults
          rows={results.rows}
          total={results.total}
          exportQuery={filterQuery(filters)}
          initialColumns={initialColumns}
        />
        {results.pageCount > 1 && (
          <nav className="pagination" aria-label="Results pages">
            {results.page > 1 ? (
              <Link href={pageHref(filters, results.page - 1)}>← Previous</Link>
            ) : (
              <span />
            )}
            <span>
              {(results.page - 1) * REFERRALS_PER_PAGE + 1}–
              {Math.min(results.page * REFERRALS_PER_PAGE, results.total)} of{" "}
              {results.total}
            </span>
            {results.page < results.pageCount ? (
              <Link href={pageHref(filters, results.page + 1)}>Next →</Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </main>
  );
}
