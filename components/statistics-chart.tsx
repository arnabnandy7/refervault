import type { StatisticRow } from "@/lib/referral-statistics";

export function StatisticsChart({ rows }: { rows: StatisticRow[] }) {
  const maximum = Math.max(...rows.map((row) => row.count), 1);

  if (!rows.length)
    return <p className="statistics-empty">No referral data is available.</p>;

  return (
    <div className="statistics-chart" role="img" aria-label="Referral count bar chart">
      {rows.map((row) => (
        <div className="statistics-bar-row" key={row.label}>
          <span className="statistics-bar-label" title={row.label}>
            {row.label}
          </span>
          <div className="statistics-bar-track">
            <span
              className="statistics-bar-fill"
              style={{ width: `${Math.max((row.count / maximum) * 100, 1)}%` }}
            />
          </div>
          <strong>{row.count.toLocaleString()}</strong>
        </div>
      ))}
    </div>
  );
}
