import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { StatisticsChart } from "@/components/statistics-chart";
import { database } from "@/lib/db";
import {
  parseStatisticCategory,
  parseStatisticLimit,
  referralStatistics,
  STATISTIC_CATEGORIES,
} from "@/lib/referral-statistics";
import { getAdmin } from "@/lib/session";

type StatisticsParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: StatisticsParams;
}) {
  if (!(await getAdmin())) redirect("/login");
  const params = await searchParams;
  const category = parseStatisticCategory(first(params.category));
  const limit = parseStatisticLimit(first(params.limit));
  const rows = await referralStatistics(database(), category, limit);
  const selected = STATISTIC_CATEGORIES.find(({ key }) => key === category)!;
  const shown = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <main className="statistics-page">
      <header className="dashboard-header">
        <Brand />
        <Link className="dashboard-add" href="/dashboard">
          Back to dashboard
        </Link>
      </header>
      <section className="statistics-intro">
        <span className="eyebrow">STATISTICS</span>
        <h1>Explore referral patterns.</h1>
        <p>Choose a column to group existing referrals and build a chart.</p>
      </section>
      <form className="statistics-controls" method="get">
        <label>
          <span>Group referrals by</span>
          <select name="category" defaultValue={category}>
            {STATISTIC_CATEGORIES.map((option) => (
              <option value={option.key} key={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Maximum categories</span>
          <select name="limit" defaultValue={String(limit)}>
            <option value="10">Top 10</option>
            <option value="25">Top 25</option>
            <option value="50">Top 50</option>
          </select>
        </label>
        <button type="submit">Build chart</button>
      </form>
      <section className="statistics-panel">
        <div className="statistics-heading">
          <div>
            <span className="eyebrow">GROUPED BY</span>
            <h2>{selected.label}</h2>
          </div>
          <p>{shown.toLocaleString()} referrals shown</p>
        </div>
        <StatisticsChart rows={rows} />
      </section>
    </main>
  );
}
