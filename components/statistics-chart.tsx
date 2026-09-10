"use client";

import { useState } from "react";
import type { StatisticRow } from "@/lib/referral-statistics";

const categoryColor = (index: number) => `hsl(${(index * 137.508 + 85) % 360} 35% 52%)`;

export function StatisticsChart({ rows }: { rows: StatisticRow[] }) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const categories = rows.filter((row) => row.count > 0);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const active = rows.find((row) => row.label === activeLabel);
  let angle = -Math.PI / 2;

  if (!total)
    return <p className="statistics-empty">No referral data is available.</p>;

  return (
    <div className="statistics-chart">
      <p className="statistics-chart-hint">Hover to see values. Select a slice or record to highlight its match.</p>
      <div className="statistics-chart-layout">
      <div className="statistics-pie-wrap">
        <svg viewBox="0 0 400 400" role="group" aria-label="Referral count pie chart">
          {categories.map((row, index) => {
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
                fill={categoryColor(index)}
                className="statistics-pie-slice"
                data-active={activeLabel === row.label}
                data-selected={selectedLabel === row.label}
                tabIndex={0}
                role="button"
                aria-pressed={selectedLabel === row.label}
                aria-label={`${row.label}: ${row.count.toLocaleString()} referrals, ${((row.count / total) * 100).toFixed(1)}% of referrals shown`}
                onPointerEnter={() => setActiveLabel(row.label)}
                onPointerLeave={() => setActiveLabel(null)}
                onFocus={() => setActiveLabel(row.label)}
                onBlur={() => setActiveLabel(null)}
                onClick={() => setSelectedLabel(row.label)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedLabel(row.label);
                  }
                  if (event.key === "Escape") {
                    setActiveLabel(null);
                    setSelectedLabel(null);
                  }
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
      <div className="statistics-records" aria-label="Referral records and counts">
        <div className="statistics-records-heading"><span>Record</span><span>Count</span></div>
        <ul>
          {categories.map((row, index) => (
            <li key={row.label}>
              <button
                type="button"
                className="statistics-record"
                aria-pressed={selectedLabel === row.label}
                data-active={activeLabel === row.label}
                onClick={() => setSelectedLabel(row.label)}
                onPointerEnter={() => setActiveLabel(row.label)}
                onPointerLeave={() => setActiveLabel(null)}
                onFocus={() => setActiveLabel(row.label)}
                onBlur={() => setActiveLabel(null)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setActiveLabel(null);
                    setSelectedLabel(null);
                  }
                }}
              >
                <span className="statistics-record-color" style={{ background: categoryColor(index) }} aria-hidden="true" />
                <span className="statistics-record-label">{row.label}</span>
                <strong>{row.count.toLocaleString()}</strong>
              </button>
            </li>
          ))}
        </ul>
      </div>
      </div>
    </div>
  );
}
