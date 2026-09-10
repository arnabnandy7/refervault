"use client";

import { useState } from "react";
import type { StatisticRow } from "@/lib/referral-statistics";

export function StatisticsChart({ rows }: { rows: StatisticRow[] }) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const active = rows.find((row) => row.label === activeLabel);
  let angle = -Math.PI / 2;

  if (!total)
    return <p className="statistics-empty">No referral data is available.</p>;

  return (
    <div className="statistics-chart">
      <p className="statistics-chart-hint">Hover, tap, or focus a slice to see its values.</p>
      <div className="statistics-pie-wrap">
        <svg viewBox="0 0 400 400" role="group" aria-label="Referral count pie chart">
          {rows.filter((row) => row.count > 0).map((row, index) => {
            const start = angle;
            const sweep = (row.count / total) * Math.PI * 2;
            angle += sweep;
            const point = (value: number) => `${200 + 180 * Math.cos(value)} ${200 + 180 * Math.sin(value)}`;
            const path = row.count === total
              ? "M 200 20 A 180 180 0 1 1 200 380 A 180 180 0 1 1 200 20 Z"
              : `M 200 200 L ${point(start)} A 180 180 0 ${sweep > Math.PI ? 1 : 0} 1 ${point(angle)} Z`;

            return (
              <path
                key={row.label}
                d={path}
                fill={`hsl(${(index * 137.508 + 85) % 360} 35% 52%)`}
                className="statistics-pie-slice"
                data-active={activeLabel === row.label}
                tabIndex={0}
                role="img"
                aria-label={`${row.label}: ${row.count.toLocaleString()} referrals, ${((row.count / total) * 100).toFixed(1)}% of referrals shown`}
                onPointerEnter={() => setActiveLabel(row.label)}
                onPointerLeave={() => setActiveLabel(null)}
                onFocus={() => setActiveLabel(row.label)}
                onBlur={() => setActiveLabel(null)}
                onClick={() => setActiveLabel(row.label)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setActiveLabel(null);
                }}
              />
            );
          })}
        </svg>
        {active ? (
          <div className="statistics-pie-tooltip" role="tooltip">
            <strong>{active.label}</strong>
            <span>{active.count.toLocaleString()} referrals · {((active.count / total) * 100).toFixed(1)}% of shown</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
