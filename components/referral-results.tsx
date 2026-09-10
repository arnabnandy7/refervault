"use client";

import { useState } from "react";
import type { ReferralSearchRow } from "@/lib/referral-search";
import {
  REFERRAL_COLUMNS,
  type ReferralColumnKey,
} from "@/lib/referral-columns";

const ALL_COLUMNS = REFERRAL_COLUMNS.map((column) => column.key);

function Cell({
  column,
  row,
}: {
  column: ReferralColumnKey;
  row: ReferralSearchRow;
}) {
  switch (column) {
    case "candidateName":
      return <strong>{row.candidateName}</strong>;
    case "referralDate":
      return row.referralDate ?? "—";
    case "jobId":
      return <strong>{row.jobId ?? "—"}</strong>;
    case "originalEmails":
      return row.originalEmails ?? "—";
    case "referredEmail":
      return row.referredEmail ?? "—";
    case "company":
      return row.company ?? "—";
    case "status":
      return <span className="status-pill">{row.status}</span>;
    case "poc":
      return row.poc ?? "—";
    case "skillset":
      return row.skillset ?? "—";
  }
}

async function writeClipboard(text: string) {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function ReferralResults({
  rows,
  total,
  exportQuery,
}: {
  rows: ReferralSearchRow[];
  total: number;
  exportQuery: string;
}) {
  const [columns, setColumns] = useState<ReferralColumnKey[]>(ALL_COLUMNS);
  const [copyState, setCopyState] = useState<
    "idle" | "copying" | "copied" | "error"
  >("idle");

  const toggleColumn = (column: ReferralColumnKey) => {
    setColumns((current) =>
      current.includes(column)
        ? current.length === 1
          ? current
          : current.filter((key) => key !== column)
        : ALL_COLUMNS.filter((key) => current.includes(key) || key === column),
    );
  };

  const copyResults = async () => {
    setCopyState("copying");
    try {
      const params = new URLSearchParams(exportQuery);
      params.set("columns", columns.join(","));
      const response = await fetch(
        `/api/referrals/export?${params.toString()}`,
      );
      if (!response.ok) throw new Error("Export failed");
      await writeClipboard(await response.text());
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2500);
    } catch {
      setCopyState("error");
    }
  };

  if (!rows.length)
    return (
      <div className="results-empty">
        <span aria-hidden="true">⌕</span>
        <h3>No referrals found</h3>
        <p>Adjust or clear the filters and search again.</p>
      </div>
    );

  return (
    <>
      <div className="table-tools">
        <details className="column-picker">
          <summary>
            Columns <span>{columns.length}</span>
          </summary>
          <fieldset>
            <legend className="sr-only">Choose visible columns</legend>
            {REFERRAL_COLUMNS.map((column) => (
              <label key={column.key}>
                <input
                  type="checkbox"
                  checked={columns.includes(column.key)}
                  onChange={() => toggleColumn(column.key)}
                />
                <span>{column.label}</span>
              </label>
            ))}
          </fieldset>
        </details>
        <button
          className="copy-results"
          type="button"
          onClick={copyResults}
          disabled={copyState === "copying"}
        >
          {copyState === "copying"
            ? "Copying…"
            : copyState === "copied"
              ? `Copied ${total.toLocaleString()} rows ✓`
              : copyState === "error"
                ? "Copy failed — retry"
                : "Copy to clipboard"}
        </button>
      </div>
      <div className="results-table-wrap">
        <table className="results-table">
          <caption className="sr-only">
            Referrals matching the selected filters
          </caption>
          <thead>
            <tr>
              {REFERRAL_COLUMNS.filter((column) =>
                columns.includes(column.key),
              ).map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {REFERRAL_COLUMNS.filter((column) =>
                  columns.includes(column.key),
                ).map((column) => (
                  <td
                    key={column.key}
                    className={
                      column.key === "referralDate"
                        ? "nowrap"
                        : column.key.includes("Email") ||
                            column.key === "referredEmail"
                          ? "email-cell"
                          : column.key === "skillset"
                            ? "skill-cell"
                            : undefined
                    }
                  >
                    <Cell column={column.key} row={row} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
